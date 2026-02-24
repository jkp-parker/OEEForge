"""Endpoints for querying OEE metrics from InfluxDB 3."""
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, Query

from app.api.deps import get_current_user
from app.core.influxdb import query_influx

router = APIRouter(prefix="/oee-metrics", tags=["oee-metrics"])


def _build_time_filter(from_time: datetime | None, to_time: datetime | None) -> str:
    parts = []
    if from_time:
        parts.append(f"time >= '{from_time.isoformat()}'")
    if to_time:
        parts.append(f"time <= '{to_time.isoformat()}'")
    return " AND ".join(parts)


@router.get("/oee")
async def get_oee_metrics(
    machine_id: str | None = Query(None),
    from_time: datetime | None = Query(None),
    to_time: datetime | None = Query(None),
    limit: int = Query(500, le=5000),
    _=Depends(get_current_user),
) -> list[dict[str, Any]]:
    filters = []
    if machine_id:
        filters.append(f"machine_id = '{machine_id}'")
    tf = _build_time_filter(from_time, to_time)
    if tf:
        filters.append(tf)
    where = f"WHERE {' AND '.join(filters)}" if filters else ""
    sql = f"SELECT * FROM oee_metrics {where} ORDER BY time DESC LIMIT {limit}"
    result = query_influx(sql)
    if not result:
        return []
    keys = list(result.keys())
    n = len(result[keys[0]]) if keys else 0
    return [{k: result[k][i] for k in keys} for i in range(n)]


@router.get("/availability")
async def get_availability_metrics(
    machine_id: str | None = Query(None),
    from_time: datetime | None = Query(None),
    to_time: datetime | None = Query(None),
    limit: int = Query(500, le=5000),
    _=Depends(get_current_user),
) -> list[dict[str, Any]]:
    filters = []
    if machine_id:
        filters.append(f"machine_id = '{machine_id}'")
    tf = _build_time_filter(from_time, to_time)
    if tf:
        filters.append(tf)
    where = f"WHERE {' AND '.join(filters)}" if filters else ""
    sql = f"SELECT * FROM availability_metrics {where} ORDER BY time DESC LIMIT {limit}"
    result = query_influx(sql)
    if not result:
        return []
    keys = list(result.keys())
    n = len(result[keys[0]]) if keys else 0
    return [{k: result[k][i] for k in keys} for i in range(n)]


@router.get("/performance")
async def get_performance_metrics(
    machine_id: str | None = Query(None),
    from_time: datetime | None = Query(None),
    to_time: datetime | None = Query(None),
    limit: int = Query(500, le=5000),
    _=Depends(get_current_user),
) -> list[dict[str, Any]]:
    filters = []
    if machine_id:
        filters.append(f"machine_id = '{machine_id}'")
    tf = _build_time_filter(from_time, to_time)
    if tf:
        filters.append(tf)
    where = f"WHERE {' AND '.join(filters)}" if filters else ""
    sql = f"SELECT * FROM performance_metrics {where} ORDER BY time DESC LIMIT {limit}"
    result = query_influx(sql)
    if not result:
        return []
    keys = list(result.keys())
    n = len(result[keys[0]]) if keys else 0
    return [{k: result[k][i] for k in keys} for i in range(n)]


@router.get("/quality")
async def get_quality_metrics(
    machine_id: str | None = Query(None),
    from_time: datetime | None = Query(None),
    to_time: datetime | None = Query(None),
    limit: int = Query(500, le=5000),
    _=Depends(get_current_user),
) -> list[dict[str, Any]]:
    filters = []
    if machine_id:
        filters.append(f"machine_id = '{machine_id}'")
    tf = _build_time_filter(from_time, to_time)
    if tf:
        filters.append(tf)
    where = f"WHERE {' AND '.join(filters)}" if filters else ""
    sql = f"SELECT * FROM quality_metrics {where} ORDER BY time DESC LIMIT {limit}"
    result = query_influx(sql)
    if not result:
        return []
    keys = list(result.keys())
    n = len(result[keys[0]]) if keys else 0
    return [{k: result[k][i] for k in keys} for i in range(n)]


@router.get("/current/{machine_id}")
async def get_current_oee(machine_id: str, _=Depends(get_current_user)) -> dict[str, Any]:
    """Return the most recent OEE snapshot for a machine."""
    sql = f"""
        SELECT * FROM oee_metrics
        WHERE machine_id = '{machine_id}'
        ORDER BY time DESC
        LIMIT 1
    """
    result = query_influx(sql)
    if not result:
        return {}
    keys = list(result.keys())
    n = len(result[keys[0]]) if keys else 0
    rows = [{k: result[k][i] for k in keys} for i in range(n)]
    return rows[0] if rows else {}
