# OEEForge

Open-source manufacturing **Overall Equipment Effectiveness (OEE)** platform.
Connect to your existing OPC-UA data pipeline, calculate OEE in real time, and give operators and managers a unified portal for monitoring and improvement.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                      Nginx :80                       │
│          /api → FastAPI    / → React Frontend        │
└──────────────────────┬──────────────────────────────┘
                       │
          ┌────────────┼────────────────┐
          ▼            ▼                ▼
     FastAPI        React           Grafana :3001
     :8000          :3000
          │
     ┌────┴─────┐
     ▼          ▼
  PostgreSQL  InfluxDB 3 Core
  :5432       :8181
     ▲          ▲
     └──────────┘
         OEE Calculation Service
         (APScheduler, runs every 5 min)
```

**Services:**
| Service | Image / Build | Purpose |
|---|---|---|
| `nginx` | `nginx:1.27-alpine` | Reverse proxy |
| `frontend` | `./frontend` | React + Shadcn/ui portal |
| `backend` | `./backend` | FastAPI REST API |
| `oee-service` | `./oee-service` | Scheduled OEE calculator |
| `postgres` | `postgres:16` | Business config & event data |
| `influxdb` | `quay.io/influxdb/influxdb3-core` | Time-series metrics |
| `grafana` | `grafana/grafana:10.4.2` | Dashboards |

---

## Quick Start

### 1. Prerequisites

- Docker >= 24 and Docker Compose >= 2.20
- Git

### 2. Clone and configure

```bash
git clone https://github.com/your-org/OEEForge.git
cd OEEForge
cp .env.example .env
```

Edit `.env` — at minimum change `POSTGRES_PASSWORD` and generate a `SECRET_KEY`:

```bash
openssl rand -hex 32   # paste output as SECRET_KEY in .env
```

### 3. Run database migrations

```bash
# Start only the database first
docker compose up -d postgres

# Run Alembic migrations
docker compose run --rm backend alembic upgrade head
```

### 4. Start all services

```bash
docker compose up -d
```

### 5. Access

| Service | URL |
|---|---|
| **App (Admin / Operator portal)** | http://localhost |
| **API docs (Swagger)** | http://localhost/docs |
| **Grafana** | http://localhost:3001 |

**Default admin credentials:** `admin` / `admin` (set via `FIRST_ADMIN_EMAIL` and `FIRST_ADMIN_PASSWORD` in `.env`)

---

## Configuration Guide

### Initial Setup (Admin Portal)

1. **Organization** — Create Sites -> Areas -> Lines -> Machines
2. **Shift Schedules** — Define named shifts with days/hours per site
3. **Products** — Add product SKUs and configure ideal cycle times per machine
4. **Downtime Codes** — Create categories (mark whether each counts against Availability) and reason codes
5. **OEE Targets** — Set Availability / Performance / Quality / OEE targets per machine or line

### OEE Component Configuration

#### Availability Settings (`/admin/availability-config`)
- Map OPC-UA state tag values to machine states: `running`, `stopped`, `faulted`, `idle`, `changeover`, `planned_downtime`
- Specify which downtime categories are **excluded** from availability loss (e.g. scheduled maintenance)
- Override planned production time per shift in seconds

#### Performance Settings (`/admin/performance-config`)
- Set **ideal cycle time** (seconds) per machine, optionally per product
- Configure the OPC-UA tag that provides cycle/part count
- Set rated speed and minor stoppage threshold

#### Quality Settings (`/admin/quality-config`)
- Configure OPC-UA tags for good parts and reject parts counts
- Or enable **manual reject entry** — operators log rejects in the Operator Portal
- Set cost-per-reject-unit for scrap cost reporting

---

## OEE Calculation

The `oee-service` runs on a configurable interval (default 5 minutes) and:

1. Fetches all machines from PostgreSQL
2. For each machine, queries InfluxDB 3 for the calculation window:
   - `machine_state` — state durations per state name
   - `production_count` — total and reject part counts
3. Applies configuration from PostgreSQL
4. Calculates:

```
Availability = Actual Run Time / Planned Production Time
Performance  = (Ideal Cycle Time x Total Parts) / Actual Run Time
Quality      = Good Parts / Total Parts
OEE          = Availability x Performance x Quality
```

5. Writes four measurements back to InfluxDB 3:
   - `oee_metrics` — combined score + all fields
   - `availability_metrics` — availability breakdown
   - `performance_metrics` — performance breakdown
   - `quality_metrics` — quality breakdown

### Expected InfluxDB measurements (written by OPC-UA pipeline)

| Measurement | Tags | Fields |
|---|---|---|
| `machine_state` | `machine_id` | `state` (string), `duration_seconds` (float) |
| `production_count` | `machine_id` | `total_count` (int), `reject_count` (int) |

---

## Project Structure

```
OEEForge/
├── docker-compose.yml
├── .env.example
├── nginx/
│   └── nginx.conf
├── backend/                    # FastAPI
│   ├── app/
│   │   ├── api/                # REST endpoints
│   │   ├── core/               # Config, DB, InfluxDB, security
│   │   ├── models/             # SQLAlchemy models
│   │   ├── schemas/            # Pydantic schemas
│   │   └── services/
│   ├── migrations/             # Alembic
│   └── Dockerfile
├── oee-service/                # OEE Calculation Service
│   ├── calculator/             # Availability, Performance, Quality, OEE
│   ├── scheduler/              # APScheduler jobs
│   └── Dockerfile
├── frontend/                   # React + Vite + Shadcn/ui
│   └── src/
│       ├── pages/
│       │   ├── admin/          # Admin portal pages
│       │   └── operator/       # Operator portal pages
│       ├── components/
│       ├── hooks/
│       └── lib/
└── grafana/
    ├── provisioning/           # Auto-provisioned datasources & dashboards
    └── dashboards/             # Dashboard JSON files
```

---

## API Reference

Full interactive docs available at `http://localhost/docs` when running.

Key endpoint groups:
- `POST /api/auth/token` — JWT login
- `GET /api/auth/me` — current user
- `/api/sites`, `/api/areas`, `/api/lines`, `/api/machines` — organization CRUD
- `/api/shift-schedules`, `/api/shift-instances` — shift management
- `/api/products`, `/api/machine-product-configs` — products & cycle times
- `/api/downtime-categories`, `/api/downtime-codes`, `/api/downtime-events` — downtime tracking
- `/api/oee-targets` — OEE targets
- `/api/availability-configs`, `/api/performance-configs`, `/api/quality-configs` — component configs
- `/api/reject-events` — reject event logging
- `/api/oee-metrics/oee`, `/api/oee-metrics/availability`, `/api/oee-metrics/performance`, `/api/oee-metrics/quality` — metrics from InfluxDB

---

## Development

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### OEE Service

```bash
cd oee-service
pip install -r requirements.txt
python main.py
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `POSTGRES_DB` | `oeeforge` | PostgreSQL database name |
| `POSTGRES_USER` | `oeeforge` | PostgreSQL user |
| `POSTGRES_PASSWORD` | `oeeforge_secret` | PostgreSQL password |
| `INFLUXDB_DATABASE` | `oeeforge` | InfluxDB 3 database name |
| `INFLUXDB_TOKEN` | _(empty)_ | InfluxDB auth token (if required) |
| `SECRET_KEY` | _(must set)_ | JWT signing secret |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `480` | JWT token lifetime |
| `FIRST_ADMIN_EMAIL` | `admin@oeeforge.local` | Initial admin user email |
| `FIRST_ADMIN_PASSWORD` | `admin` | Initial admin user password |
| `OEE_CALC_INTERVAL_SECONDS` | `300` | OEE calculation interval |
| `GRAFANA_USER` | `admin` | Grafana admin username |
| `GRAFANA_PASSWORD` | `admin` | Grafana admin password |

---

## License

Apache 2.0 — see [LICENSE](LICENSE)
