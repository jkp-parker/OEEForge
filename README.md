# OEEForge

Open-source **Overall Equipment Effectiveness (OEE)** monitoring platform for manufacturing operations. Connect to your OPC-UA / SCADA data pipeline, calculate OEE in real time, and give operators and managers a unified portal for monitoring and continuous improvement.

## Quick Start

### Prerequisites

- Docker 24+ and Docker Compose v2+
- Git

### 1. Clone and configure

```bash
git clone https://github.com/jkp-parker/OEEForge.git
cd OEEForge
cp .env.example .env
```

Edit `.env` — at minimum set `SECRET_KEY`, `POSTGRES_PASSWORD`, and `INFLUXDB3_ADMIN_TOKEN`:

```bash
SECRET_KEY=$(openssl rand -hex 32)
INFLUXDB3_ADMIN_TOKEN=apiv3_$(openssl rand -hex 32)
```

> `INFLUXDB3_ADMIN_TOKEN` must start with `apiv3_`.

### 2. Start the stack

```bash
docker compose up -d
```

Database migrations run automatically on first start. The stack is ready in ~60 seconds.

### 3. Open the app

| Service | URL |
|---------|-----|
| App (Admin / Operator portal) | http://localhost |
| API docs (Swagger) | http://localhost/docs |
| Grafana | http://localhost:3001 |

**Default admin:** `admin@oeeforge.local` / `admin`

### 4. Load sample data (optional)

Navigate to **Admin > System** in the sidebar and click **Load Sample Data**, or run from the CLI:

```bash
docker compose exec backend python /app/scripts/seed_sample_data.py
```

This seeds 7 days of OEE data for a fictional plant (WidgetCo Manufacturing — 3 lines, 10 machines) so every dashboard and chart populates immediately.

## Stack

| Service | Technology | Purpose |
|---------|-----------|---------|
| `frontend` | React 18 + Vite + nginx | Admin and operator portals + reverse proxy |
| `backend` | FastAPI + SQLAlchemy | REST API + business logic |
| `oee-service` | Python + APScheduler | OEE calculation and tag monitoring |
| `postgres` | PostgreSQL 16 | Configuration, events, shift data |
| `influxdb` | InfluxDB 3 Core | Time-series OEE metrics and tag data |
| `grafana` | Grafana OSS 12.4 | Optional dashboarding (SQL mode via FlightSQL) |

OEE is computed as **Availability × Performance × Quality** on a configurable interval (default 5 min) and written back to InfluxDB for the frontend to query.

Service health and build versions (PostgreSQL, InfluxDB, Grafana) can be monitored from the **System Administration** page (`/admin/system`), which also provides UI controls for loading and clearing sample data.

## Documentation

Full documentation is available in the [GitHub Wiki](https://github.com/jkp-parker/OEEForge/wiki):

- [Getting Started](https://github.com/jkp-parker/OEEForge/wiki/Getting-Started) — installation, first login, initial setup steps
- [Architecture](https://github.com/jkp-parker/OEEForge/wiki/Architecture) — system design, data flow, directory structure
- [Configuration](https://github.com/jkp-parker/OEEForge/wiki/Configuration) — all environment variables and service settings
- [OEE Calculations](https://github.com/jkp-parker/OEEForge/wiki/OEE-Calculations) — formulas, tag monitor logic, worked examples
- [API Reference](https://github.com/jkp-parker/OEEForge/wiki/API-Reference) — all REST endpoints with request/response examples
- [Data Models](https://github.com/jkp-parker/OEEForge/wiki/Data-Models) — PostgreSQL schema and InfluxDB measurements
- [Frontend](https://github.com/jkp-parker/OEEForge/wiki/Frontend) — pages, components, routing, and API client
- [Sample Data](https://github.com/jkp-parker/OEEForge/wiki/Sample-Data) — WidgetCo demo dataset details
- [Deployment](https://github.com/jkp-parker/OEEForge/wiki/Deployment) — TLS, backups, upgrades, and production checklist

## License

Apache 2.0 — see [LICENSE](LICENSE)
