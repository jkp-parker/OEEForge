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
| `frontend` | `./frontend` | React + Vite portal |
| `backend` | `./backend` | FastAPI REST API |
| `oee-service` | `./oee-service` | Scheduled OEE calculator |
| `postgres` | `postgres:16` | Business config & event data |
| `influxdb` | `quay.io/influxdb/influxdb3-core` | Time-series metrics |
| `explorer` | `influxdata/influxdb3-ui:1.6.2` | InfluxDB 3 Explorer UI |
| `grafana` | `grafana/grafana:10.4.2` | Dashboards |

---

## Quick Start

### 1. Prerequisites

- Docker >= 24 and Docker Compose >= 2.20
- Git

### 2. Clone and configure

```bash
git clone https://github.com/jkp-parker/OEEForge.git
cd OEEForge
cp .env.example .env
```

Edit `.env` — at minimum set `POSTGRES_PASSWORD`, `SECRET_KEY`, and `INFLUXDB3_ADMIN_TOKEN`:

```bash
# Generate SECRET_KEY
openssl rand -hex 32

# Generate INFLUXDB3_ADMIN_TOKEN (must start with apiv3_)
echo "apiv3_$(openssl rand -hex 32)"
```

### 3. Start all services

```bash
docker compose up -d
```

The backend automatically runs `alembic upgrade head` on startup before serving requests.

### 4. Access

| Service | URL |
|---|---|
| **App (Admin / Operator portal)** | http://localhost |
| **API docs (Swagger)** | http://localhost/docs |
| **InfluxDB 3 Explorer** | http://localhost:8888 |
| **Grafana** | http://localhost:3001 |

**Default admin credentials:** `admin@oeeforge.local` / `admin` (set via `FIRST_ADMIN_EMAIL` and `FIRST_ADMIN_PASSWORD` in `.env`)

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
├── frontend/                   # React + Vite
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
| `INFLUXDB3_ADMIN_TOKEN` | _(must set)_ | InfluxDB admin token — must start with `apiv3_` |
| `SECRET_KEY` | _(must set)_ | JWT signing secret |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `480` | JWT token lifetime |
| `FIRST_ADMIN_EMAIL` | `admin@oeeforge.local` | Initial admin user email |
| `FIRST_ADMIN_PASSWORD` | `admin` | Initial admin user password |
| `OEE_CALC_INTERVAL_SECONDS` | `300` | OEE calculation interval (seconds) |
| `TAG_MONITOR_INTERVAL_SECONDS` | `60` | Interval for InfluxDB tag-based downtime monitoring (seconds) |
| `GRAFANA_USER` | `admin` | Grafana admin username |
| `GRAFANA_PASSWORD` | `admin` | Grafana admin password |

---

## Sample Data

OEEForge ships with a seeder script that loads **one week of realistic widget-manufacturing data** so you can explore every screen immediately after starting the stack — no OPC-UA connection required.

### What the seeder creates

**Company:** WidgetCo Manufacturing — Plant 1

| Layer | Entries |
|---|---|
| Site → Area → Lines | 1 site · 1 area · **3 production lines** |
| Machines | **10 machines** spread across the 3 lines |
| Shift schedules | Day Shift (06:00–18:00) · Night Shift (18:00–06:00) · 7 days/week |
| Shift instances | 14 shifts per machine · 140 in total |
| Products | Standard Widget (WDG-STD) · Premium Widget (WDG-PRE) · Widget Housing (WDG-HSG) |
| Downtime taxonomy | 5 primary categories · 10 secondary categories · 24 reason codes |
| Downtime events | Varied per machine profile — 2–8 events per shift with realistic durations |
| OEE targets | Set at 90 / 95 / 99 / 85 % (A/P/Q/OEE) per machine |
| InfluxDB metrics | `oee_metrics`, `availability_metrics`, `performance_metrics`, `quality_metrics` — one point every 30 min per machine for 7 days |

**Production lines and machines:**

| Line | Machines | Character |
|---|---|---|
| Assembly Alpha | A1 · A2 · A3 · Welding Station | Mixed — A1 is best performer, A3 is the floor's oldest machine |
| Fabrication Beta | Press B1 · Press B2 · CNC Router · Quality Inspector | Varied — CNC has long changeovers, Inspector has frequent quality stops |
| Packaging Gamma | Packager G1 · Packager G2 | G1 is fast and reliable, G2 is breakdown-prone |

Each machine has a distinct OEE fingerprint (availability 69–93 %, performance 78–92 %, quality 94–99 %) and favours different downtime root causes, so the dashboard charts show meaningful variance across the fleet.

### Load the sample data

```bash
# With the stack running:
docker compose exec backend python /app/scripts/seed_sample_data.py
```

Open the admin portal at **http://localhost**, select the **7d** time range on the dashboard, and all charts will populate.

To wipe the sample data and re-seed with a fresh random week:

```bash
docker compose exec backend python /app/scripts/seed_sample_data.py --clear
```

### Removing sample data for production use

The seeder creates all data under a single top-level site called **"WidgetCo - Plant 1"**. Deleting that site cascades through the entire hierarchy.  Run the clear flag once before configuring your real plant:

```bash
docker compose exec backend python /app/scripts/seed_sample_data.py --clear
```

Then configure your own organisation, machines, shift schedules, products, and downtime codes through the **Admin Portal** (`/admin`).  InfluxDB metrics written by the seeder are also removed on a best-effort basis (requires your InfluxDB 3 build to support SQL `DELETE`).

> **Tip:** The script is idempotent — if WidgetCo data already exists it will print a notice and exit rather than duplicate records.

---

## License

Apache 2.0 — see [LICENSE](LICENSE)
