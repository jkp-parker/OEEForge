import asyncio
import subprocess

import httpx
from fastapi import APIRouter, Depends
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_admin
from app.core.config import settings
from app.models.organization import Site

router = APIRouter(prefix="/system", tags=["system-admin"])

SERVICES = [
    {"name": "frontend", "description": "React UI + Nginx", "port": "80"},
    {"name": "backend", "description": "FastAPI", "port": "8000"},
    {"name": "oee-service", "description": "OEE Calculator", "port": None},
    {"name": "postgres", "description": "PostgreSQL", "port": "5432"},
    {"name": "influxdb", "description": "InfluxDB 3 Core", "port": "8181"},
    {"name": "grafana", "description": "Grafana", "port": "3001", "url": "/grafana"},
]


async def _check_http(client: httpx.AsyncClient, url: str, headers: dict | None = None) -> tuple[str, dict | None]:
    """Return (status, json_body_or_None)."""
    try:
        r = await client.get(url, headers=headers or {})
        body = None
        try:
            body = r.json()
        except Exception:
            pass
        return ("ok" if r.status_code < 400 else "error", body)
    except Exception:
        return ("error", None)


def _extract_version(name: str, body: dict | None) -> str | None:
    if not body:
        return None
    if name == "grafana":
        return body.get("version")
    if name == "influxdb":
        return body.get("version")
    return None


@router.get("/health")
async def system_health(db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    results = {}
    versions = {}

    # Backend is always ok (we're serving this request)
    results["backend"] = "ok"
    # Frontend/nginx is always ok (request came through it)
    results["frontend"] = "ok"
    # OEE service has no health endpoint
    results["oee-service"] = "no_health_check"

    # Check PostgreSQL + version
    try:
        row = await db.execute(text("SHOW server_version"))
        pg_version = row.scalar()
        results["postgres"] = "ok"
        versions["postgres"] = pg_version
    except Exception:
        results["postgres"] = "error"

    # Check HTTP services concurrently
    async with httpx.AsyncClient(timeout=5.0) as client:
        influx_headers = {"Authorization": f"Bearer {settings.INFLUXDB_TOKEN}"}
        checks = await asyncio.gather(
            _check_http(client, f"{settings.INFLUXDB_URL}/health", influx_headers),
            _check_http(client, "http://grafana:3000/api/health"),
        )
        results["influxdb"] = checks[0][0]
        results["grafana"] = checks[1][0]
        versions["grafana"] = _extract_version("grafana", checks[1][1])

        # InfluxDB version via SQL endpoint
        if results["influxdb"] == "ok":
            try:
                r = await client.post(
                    f"{settings.INFLUXDB_URL}/api/v3/query_sql",
                    headers={**influx_headers, "Content-Type": "application/json"},
                    json={"db": settings.INFLUXDB_DATABASE, "q": "SELECT version()"},
                )
                rows = r.json()
                if rows and isinstance(rows, list):
                    raw = rows[0].get("version()", "")
                    # e.g. "Apache DataFusion 50.3.0, x86_64 on linux"
                    # Extract just "DataFusion 50.3.0"
                    part = raw.split(",")[0].replace("Apache ", "") if raw else ""
                    versions["influxdb"] = part or None
            except Exception:
                pass

    services = []
    for svc in SERVICES:
        entry = {
            **svc,
            "status": results.get(svc["name"], "error"),
        }
        ver = versions.get(svc["name"])
        if ver:
            entry["version"] = ver
        services.append(entry)
    return {"services": services}


@router.get("/sample-data/status")
async def sample_data_status(db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    result = await db.execute(select(Site).where(Site.name == "WidgetCo - Plant 1"))
    loaded = result.scalar_one_or_none() is not None
    return {"loaded": loaded}


@router.post("/sample-data/load")
async def load_sample_data(_=Depends(require_admin)):
    try:
        proc = await asyncio.to_thread(
            subprocess.run,
            ["python", "/app/scripts/seed_sample_data.py"],
            capture_output=True,
            text=True,
            timeout=120,
        )
        return {
            "success": proc.returncode == 0,
            "output": proc.stdout + proc.stderr,
        }
    except subprocess.TimeoutExpired:
        return {"success": False, "output": "Script timed out after 120 seconds"}


@router.post("/sample-data/clear")
async def clear_sample_data(_=Depends(require_admin)):
    try:
        proc = await asyncio.to_thread(
            subprocess.run,
            ["python", "/app/scripts/seed_sample_data.py", "--clear-only"],
            capture_output=True,
            text=True,
            timeout=120,
        )
        return {
            "success": proc.returncode == 0,
            "output": proc.stdout + proc.stderr,
        }
    except subprocess.TimeoutExpired:
        return {"success": False, "output": "Script timed out after 120 seconds"}
