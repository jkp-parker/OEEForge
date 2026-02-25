#!/usr/bin/env python3
"""
OEEForge Sample Data Seeder
=============================================================
Company : WidgetCo Manufacturing
Plant   : Plant 1 — Main Production Floor
Lines   : 3  (Assembly Alpha, Fabrication Beta, Packaging Gamma)
Machines: 10
Shifts  : 2 × 12-hour per day (Day 06:00–18:00, Night 18:00–06:00 UTC)
Period  : 7 days of historical data

PostgreSQL records created:
  Site → Area → 3 Lines → 10 Machines
  2 Shift Schedules (Day / Night) + Shift Instances for every machine every day
  3 Products + machine-product ideal cycle-time configs
  5-tier Downtime Taxonomy (Primary → Secondary → Code)  ·  5 / 10 / 24 entries
  Realistic Downtime Events per shift per machine
  OEE Targets per machine

InfluxDB 3 measurements written:
  oee_metrics, availability_metrics, performance_metrics, quality_metrics
  One data point every 30 minutes per machine across the full 7-day window

Usage:
    # Run once on a fresh stack:
    docker compose exec backend python /app/scripts/seed_sample_data.py

    # Wipe WidgetCo sample data and re-seed (PostgreSQL + InfluxDB):
    docker compose exec backend python /app/scripts/seed_sample_data.py --clear

    # Outside Docker (ensure env vars point to exposed ports):
    DATABASE_URL=postgresql://oeeforge:oeeforge_secret@localhost:5432/oeeforge \\
    INFLUXDB_URL=http://localhost:8181 \\
    INFLUXDB_DATABASE=oeeforge \\
    INFLUXDB_TOKEN=apiv3_... \\
    python scripts/seed_sample_data.py
"""

import asyncio
import json
import os
import random
import sys
import urllib.request
import urllib.error
from datetime import datetime, time, timedelta, timezone

import asyncpg

# ── Environment ────────────────────────────────────────────────────────────────

DB_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://oeeforge:oeeforge_secret@postgres:5432/oeeforge",
).replace("postgresql+asyncpg://", "postgresql://")

INFLUX_BASE = os.getenv("INFLUXDB_URL", "http://influxdb:8181")
INFLUX_DB   = os.getenv("INFLUXDB_DATABASE", "oeeforge")
INFLUX_TOK  = os.getenv("INFLUXDB_TOKEN", os.getenv("INFLUXDB3_ADMIN_TOKEN", ""))

CLEAR = "--clear" in sys.argv
RNG   = random.Random(42)   # Fixed seed → reproducible data

# ── Static definitions ─────────────────────────────────────────────────────────

SITE_NAME = "WidgetCo - Plant 1"
AREA_NAME = "Main Production Floor"

LINES_DEF = [
    ("Assembly Alpha",   "Widget sub-assembly — 4 stations"),
    ("Fabrication Beta", "Metal fabrication and CNC machining — 4 cells"),
    ("Packaging Gamma",  "Final packaging and despatch — 2 lines"),
]

# (name, line_idx 0-based, ideal_cycle_time_seconds, description)
MACHINES_DEF = [
    ("Alpha Assembler A1",     0,  45, "Primary widget assembly station"),
    ("Alpha Assembler A2",     0,  45, "Secondary widget assembly station"),
    ("Alpha Assembler A3",     0,  48, "Legacy assembler — scheduled for upgrade"),
    ("Alpha Welding Station",  0,  60, "Robotic MIG welding cell"),
    ("Beta Press B1",          1,  30, "80-tonne hydraulic press — primary"),
    ("Beta Press B2",          1,  32, "80-tonne hydraulic press — secondary"),
    ("Beta CNC Router",        1,  90, "5-axis CNC machining centre"),
    ("Beta Quality Inspector", 1,  20, "Automated vision quality inspection station"),
    ("Gamma Packager G1",      2,  15, "High-speed blister packer"),
    ("Gamma Packager G2",      2,  17, "Rotary case packer"),
]

PRODUCTS_DEF = [
    ("Standard Widget", "WDG-STD", "Standard-grade widget — core product line"),
    ("Premium Widget",  "WDG-PRE", "Premium-grade widget with enhanced tolerances"),
    ("Widget Housing",  "WDG-HSG", "Injection-moulded widget housing assembly"),
]

# Downtime taxonomy: list of (primary_name, counts_against_availability, [secondaries])
# Each secondary: (name, [(code_name, description)])
TAXONOMY = [
    ("Equipment Failure", True, [
        ("Mechanical", [
            ("Bearing Failure",        "Roller or ball bearing worn or seized"),
            ("Drive Belt Break",       "V-belt or timing belt failure"),
            ("Hydraulic Leak",         "Hydraulic line or cylinder seal failure"),
            ("Jam / Blockage",         "Material jam or conveyor blockage"),
        ]),
        ("Electrical", [
            ("PLC Fault",              "Programmable logic controller fault or reset"),
            ("Sensor Failure",         "Proximity, vision or pressure sensor failure"),
            ("Motor Overload",         "Drive motor tripped on thermal overload"),
        ]),
    ]),
    ("Planned Maintenance", False, [
        ("Preventive", [
            ("Oil & Lubrication",      "Scheduled lubrication service"),
            ("Filter Replacement",     "Pneumatic or hydraulic filter change"),
            ("Tooling Inspection",     "Scheduled tool wear check and replacement"),
        ]),
        ("Scheduled Downtime", [
            ("Calibration",            "Sensor, gauge or vision system calibration"),
            ("Cleaning",               "Scheduled deep clean and sanitisation"),
        ]),
    ]),
    ("Changeover", True, [
        ("Product Change", [
            ("Tooling Change",             "Die, mould or fixture swap between products"),
            ("Recipe / Programme Change",  "CNC or PLC programme / recipe update"),
        ]),
        ("Material Supply", [
            ("Material Reload",        "Loading new material batch or pallet"),
            ("Reel / Coil Change",     "Replacing exhausted coil or reel"),
        ]),
    ]),
    ("Quality Stop", True, [
        ("Process Issue", [
            ("Dimension Out of Spec",  "Part dimensions outside drawing tolerance"),
            ("Surface Defect",         "Surface finish or cosmetic defect on part"),
            ("Assembly Error",         "Incorrect component pick or assembly sequence"),
        ]),
        ("Material Issue", [
            ("Raw Material Defect",    "Incoming raw material non-conformance"),
            ("Packaging Fault",        "Packaging material tear, jam or feed failure"),
        ]),
    ]),
    ("Utilities", True, [
        ("Facilities", [
            ("Air Pressure Loss",      "Compressed air header pressure drop"),
            ("Water Supply Issue",     "Cooling water flow loss or contamination"),
            ("HVAC Fault",             "Ventilation or environmental control fault"),
        ]),
    ]),
]

# Per-machine OEE profile:
#   avail / perf / qual  — central tendency  (0–1)
#   noise                — std-dev applied per window for realistic variation
#   dt_cats              — probability weights for picking downtime category (cat index 0-4)
#   dt_n                 — (min, max) downtime events generated per shift
PROFILES = [
    # Alpha Assembler A1 — reliable, best performer on the floor
    {"avail": 0.93, "perf": 0.90, "qual": 0.98, "noise": 0.03,
     "dt_cats": [0.20, 0.25, 0.40, 0.10, 0.05], "dt_n": (2, 4)},
    # Alpha Assembler A2 — good, occasional mixed faults
    {"avail": 0.86, "perf": 0.87, "qual": 0.97, "noise": 0.05,
     "dt_cats": [0.30, 0.20, 0.35, 0.10, 0.05], "dt_n": (2, 5)},
    # Alpha Assembler A3 — older machine, heavy mechanical failures
    {"avail": 0.77, "perf": 0.82, "qual": 0.96, "noise": 0.08,
     "dt_cats": [0.50, 0.18, 0.20, 0.08, 0.04], "dt_n": (3, 7)},
    # Alpha Welding Station — maintenance-heavy, long changeovers
    {"avail": 0.82, "perf": 0.78, "qual": 0.99, "noise": 0.06,
     "dt_cats": [0.15, 0.35, 0.42, 0.05, 0.03], "dt_n": (2, 5)},
    # Beta Press B1 — high throughput, occasional material jams
    {"avail": 0.88, "perf": 0.91, "qual": 0.97, "noise": 0.04,
     "dt_cats": [0.32, 0.18, 0.30, 0.15, 0.05], "dt_n": (2, 4)},
    # Beta Press B2 — minor stoppages and quality stops
    {"avail": 0.80, "perf": 0.84, "qual": 0.96, "noise": 0.06,
     "dt_cats": [0.28, 0.15, 0.32, 0.20, 0.05], "dt_n": (3, 6)},
    # Beta CNC Router — very long changeovers dominate downtime
    {"avail": 0.75, "perf": 0.80, "qual": 0.99, "noise": 0.07,
     "dt_cats": [0.22, 0.20, 0.48, 0.07, 0.03], "dt_n": (2, 5)},
    # Beta Quality Inspector — frequent quality stops, sensor faults
    {"avail": 0.85, "perf": 0.88, "qual": 0.94, "noise": 0.05,
     "dt_cats": [0.20, 0.15, 0.20, 0.40, 0.05], "dt_n": (2, 5)},
    # Gamma Packager G1 — fast, reliable, mainly product changeovers
    {"avail": 0.90, "perf": 0.92, "qual": 0.98, "noise": 0.03,
     "dt_cats": [0.15, 0.18, 0.55, 0.08, 0.04], "dt_n": (1, 3)},
    # Gamma Packager G2 — breakdown-prone, lowest OEE on floor
    {"avail": 0.69, "perf": 0.78, "qual": 0.97, "noise": 0.10,
     "dt_cats": [0.58, 0.14, 0.18, 0.06, 0.04], "dt_n": (4, 8)},
]

# Duration ranges (minutes) by primary category index
DT_DURATION_MIN = {0: (5, 60), 1: (20, 90), 2: (10, 45), 3: (5, 25), 4: (5, 30)}

# ── Helpers ────────────────────────────────────────────────────────────────────

def clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def pick_oee(profile: dict) -> tuple[float, float, float]:
    """Return (availability, performance, quality) with Gaussian noise."""
    a = clamp(RNG.gauss(profile["avail"], profile["noise"]), 0.40, 0.999)
    p = clamp(RNG.gauss(profile["perf"],  profile["noise"]), 0.40, 0.999)
    q = clamp(RNG.gauss(profile["qual"],  profile["noise"] * 0.5), 0.70, 0.9999)
    return a, p, q


def generate_downtime_events(
    profile: dict,
    shift_start: datetime,
    shift_end: datetime,
    code_ids_by_cat: dict[int, list[int]],
) -> list[tuple[datetime, datetime, int]]:
    """Generate a list of (start, end, reason_code_id) tuples for one shift."""
    events: list[tuple[datetime, datetime, int]] = []
    n = RNG.randint(*profile["dt_n"])
    cat_weights = profile["dt_cats"]
    cat_indices = list(range(len(cat_weights)))

    cursor = shift_start + timedelta(minutes=RNG.randint(5, 20))

    for _ in range(n):
        remaining_min = (shift_end - cursor).total_seconds() / 60
        if remaining_min < 15:
            break

        cat = RNG.choices(cat_indices, weights=cat_weights)[0]
        codes = code_ids_by_cat.get(cat, [])
        if not codes:
            continue

        code_id = RNG.choice(codes)
        dur_lo, dur_hi = DT_DURATION_MIN[cat]
        dur_min = RNG.randint(dur_lo, min(dur_hi, int(remaining_min * 0.7)))
        if dur_min < 1:
            dur_min = 1

        gap = timedelta(minutes=RNG.randint(10, max(10, int(remaining_min * 0.25))))
        ev_start = cursor + gap
        ev_end   = ev_start + timedelta(minutes=dur_min)

        if ev_end >= shift_end - timedelta(minutes=5):
            break

        events.append((ev_start, ev_end, code_id))
        cursor = ev_end

    return events


def build_influx_lp(
    machine_id: int,
    shift_start: datetime,
    shift_end: datetime,
    avail: float,
    perf: float,
    qual: float,
    ideal_cycle_time_s: float,
) -> list[str]:
    """
    Build InfluxDB line-protocol strings for all four OEE measurements.
    Generates one record per 30-minute window within the shift.
    """
    lines: list[str] = []
    shift_id = shift_start.strftime("%Y%m%d%H%M")
    mid = str(machine_id)
    window_size = timedelta(minutes=30)
    cursor = shift_start + window_size  # first record at shift_start + 30min

    while cursor <= shift_end:
        # Per-window noise so the trend chart shows realistic variation
        w_avail = clamp(avail + RNG.gauss(0, 0.015), 0.10, 1.0)
        w_perf  = clamp(perf  + RNG.gauss(0, 0.015), 0.10, 1.0)
        w_qual  = clamp(qual  + RNG.gauss(0, 0.007), 0.50, 1.0)
        w_oee   = round(w_avail * w_perf * w_qual, 6)

        window_s        = int(window_size.total_seconds())
        run_time_s      = int(window_s * w_avail)
        downtime_s      = window_s - run_time_s
        total_parts     = int(run_time_s / ideal_cycle_time_s * w_perf) if ideal_cycle_time_s > 0 else 0
        good_parts      = int(total_parts * w_qual)
        reject_parts    = total_parts - good_parts
        run_faulted_s   = int(downtime_s * 0.6)
        run_stopped_s   = downtime_s - run_faulted_s

        ts_ns = int(cursor.timestamp() * 1_000_000_000)

        # oee_metrics
        lines.append(
            f"oee_metrics,machine_id={mid},shift_id={shift_id} "
            f"availability={w_avail:.6f},"
            f"performance={w_perf:.6f},"
            f"quality={w_qual:.6f},"
            f"oee={w_oee:.6f},"
            f"planned_time_seconds={window_s}i,"
            f"actual_run_time_seconds={run_time_s}i,"
            f"downtime_seconds={downtime_s}i,"
            f"total_parts={total_parts}i,"
            f"good_parts={good_parts}i,"
            f"reject_parts={reject_parts}i "
            f"{ts_ns}"
        )

        # availability_metrics
        lines.append(
            f"availability_metrics,machine_id={mid},shift_id={shift_id} "
            f"value={w_avail:.6f},"
            f"planned_time_seconds={window_s}i,"
            f"actual_run_time_seconds={run_time_s}i,"
            f"downtime_seconds={downtime_s}i,"
            f"state_running_seconds={run_time_s}i,"
            f"state_stopped_seconds={run_stopped_s}i,"
            f"state_faulted_seconds={run_faulted_s}i "
            f"{ts_ns}"
        )

        # performance_metrics
        lines.append(
            f"performance_metrics,machine_id={mid},shift_id={shift_id} "
            f"value={w_perf:.6f},"
            f"total_parts={total_parts}i,"
            f"good_parts={good_parts}i,"
            f"ideal_cycle_time={ideal_cycle_time_s:.2f},"
            f"actual_run_time_seconds={run_time_s}i "
            f"{ts_ns}"
        )

        # quality_metrics
        lines.append(
            f"quality_metrics,machine_id={mid},shift_id={shift_id} "
            f"value={w_qual:.6f},"
            f"total_parts={total_parts}i,"
            f"good_parts={good_parts}i,"
            f"reject_parts={reject_parts}i "
            f"{ts_ns}"
        )

        cursor += window_size

    return lines


def influx_write(lp_lines: list[str]) -> None:
    """POST line-protocol to InfluxDB 3 in batches of 500 records."""
    if not lp_lines:
        return

    headers = {
        "Authorization": f"Bearer {INFLUX_TOK}",
        "Content-Type": "text/plain; charset=utf-8",
    }
    url = f"{INFLUX_BASE}/api/v3/write_lp?db={INFLUX_DB}&precision=nanosecond"

    batch_size = 500
    for i in range(0, len(lp_lines), batch_size):
        batch = lp_lines[i: i + batch_size]
        body  = "\n".join(batch).encode("utf-8")
        req   = urllib.request.Request(url, data=body, headers=headers, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                status = resp.status
                if status not in (200, 204):
                    print(f"  [WARN] InfluxDB write returned HTTP {status}")
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")[:300]
            print(f"  [WARN] InfluxDB write HTTP {exc.code}: {detail}")
        except Exception as exc:
            print(f"  [WARN] InfluxDB write failed: {exc}")

    total = len(lp_lines) // 4   # 4 measurements per data point
    print(f"  → InfluxDB: wrote ~{total} time-series points across 4 measurements")


def influx_delete_range(start: datetime, end: datetime) -> None:
    """Attempt to delete all OEE measurements in the given time range."""
    start_s = start.strftime("%Y-%m-%dT%H:%M:%SZ")
    end_s   = end.strftime("%Y-%m-%dT%H:%M:%SZ")
    for meas in ("oee_metrics", "availability_metrics", "performance_metrics", "quality_metrics"):
        sql = f"DELETE FROM {meas} WHERE time >= '{start_s}' AND time <= '{end_s}'"
        payload = json.dumps({"db": INFLUX_DB, "q": sql}).encode("utf-8")
        url = f"{INFLUX_BASE}/api/v3/query_sql"
        headers = {
            "Authorization": f"Bearer {INFLUX_TOK}",
            "Content-Type": "application/json",
        }
        req = urllib.request.Request(url, data=payload, headers=headers, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=15):
                pass
        except Exception:
            pass   # DELETE via SQL may not be supported in all InfluxDB 3 builds — skip silently


# ── Database operations ────────────────────────────────────────────────────────

async def get_or_create(
    conn: asyncpg.Connection,
    table: str,
    match_col: str,
    match_val,
    insert_cols: list[str],
    insert_vals: list,
) -> int:
    row = await conn.fetchrow(f"SELECT id FROM {table} WHERE {match_col} = $1", match_val)
    if row:
        return row["id"]
    placeholders = ", ".join(f"${i + 1}" for i in range(len(insert_vals)))
    cols_sql = ", ".join(insert_cols)
    return await conn.fetchval(
        f"INSERT INTO {table} ({cols_sql}) VALUES ({placeholders}) RETURNING id",
        *insert_vals,
    )


async def seed(conn: asyncpg.Connection) -> None:  # noqa: C901
    print("\n── WidgetCo sample data seeder ──────────────────────────────")

    # ── 1. Organisation hierarchy ─────────────────────────────────────────────
    print("Creating organisation hierarchy …")
    site_id = await get_or_create(
        conn, "sites", "name", SITE_NAME,
        ["name", "description", "timezone"],
        [SITE_NAME, "WidgetCo widget manufacturing — Plant 1", "UTC"],
    )
    area_id = await get_or_create(
        conn, "areas", "name", AREA_NAME,
        ["site_id", "name", "description"],
        [site_id, AREA_NAME, "Primary production floor"],
    )

    line_ids: list[int] = []
    for name, desc in LINES_DEF:
        lid = await get_or_create(
            conn, "lines", "name", name,
            ["area_id", "name", "description"],
            [area_id, name, desc],
        )
        line_ids.append(lid)
    print(f"  Site {site_id} · Area {area_id} · Lines {line_ids}")

    machine_ids: list[int] = []
    for name, line_idx, ict, desc in MACHINES_DEF:
        mid = await get_or_create(
            conn, "machines", "name", name,
            ["line_id", "name", "description"],
            [line_ids[line_idx], name, desc],
        )
        machine_ids.append(mid)
    print(f"  Machines: {machine_ids}")

    # ── 2. Shift schedules ────────────────────────────────────────────────────
    print("Creating shift schedules …")
    days_all = json.dumps([0, 1, 2, 3, 4, 5, 6])
    day_sched_id = await get_or_create(
        conn, "shift_schedules", "name", "Day Shift",
        ["site_id", "name", "start_time", "end_time", "days_of_week", "is_active"],
        [site_id, "Day Shift", time.fromisoformat("06:00:00"), time.fromisoformat("18:00:00"), days_all, True],
    )
    night_sched_id = await get_or_create(
        conn, "shift_schedules", "name", "Night Shift",
        ["site_id", "name", "start_time", "end_time", "days_of_week", "is_active"],
        [site_id, "Night Shift", time.fromisoformat("18:00:00"), time.fromisoformat("06:00:00"), days_all, True],
    )
    print(f"  Day schedule {day_sched_id} · Night schedule {night_sched_id}")

    # ── 3. Products + machine-product configs ─────────────────────────────────
    print("Creating products …")
    product_ids: list[int] = []
    for pname, sku, pdesc in PRODUCTS_DEF:
        pid = await conn.fetchval(
            "SELECT id FROM products WHERE sku = $1", sku
        )
        if pid is None:
            pid = await conn.fetchval(
                "INSERT INTO products (name, sku, description) VALUES ($1, $2, $3) RETURNING id",
                pname, sku, pdesc,
            )
        product_ids.append(pid)

    # Assign ideal cycle times: each machine × first product (Standard Widget)
    std_pid = product_ids[0]
    for m_idx, machine_id in enumerate(machine_ids):
        _, _, ict, _ = MACHINES_DEF[m_idx]
        exists = await conn.fetchval(
            "SELECT id FROM machine_product_configs WHERE machine_id=$1 AND product_id=$2",
            machine_id, std_pid,
        )
        if not exists:
            await conn.execute(
                "INSERT INTO machine_product_configs (machine_id, product_id, ideal_cycle_time_seconds) "
                "VALUES ($1, $2, $3)",
                machine_id, std_pid, float(ict),
            )
    print(f"  Products: {product_ids}")

    # ── 4. Downtime taxonomy ──────────────────────────────────────────────────
    print("Creating downtime taxonomy …")
    code_ids_by_cat: dict[int, list[int]] = {}
    for cat_idx, (cat_name, counts_avail, secondaries) in enumerate(TAXONOMY):
        cat_id = await get_or_create(
            conn, "downtime_categories", "name", cat_name,
            ["name", "counts_against_availability"],
            [cat_name, counts_avail],
        )
        cat_codes: list[int] = []
        for sec_name, codes in secondaries:
            sec_id = await conn.fetchval(
                "SELECT id FROM downtime_secondary_categories "
                "WHERE primary_category_id=$1 AND name=$2",
                cat_id, sec_name,
            )
            if sec_id is None:
                sec_id = await conn.fetchval(
                    "INSERT INTO downtime_secondary_categories "
                    "(primary_category_id, name) VALUES ($1, $2) RETURNING id",
                    cat_id, sec_name,
                )
            for code_name, code_desc in codes:
                code_id = await conn.fetchval(
                    "SELECT id FROM downtime_codes "
                    "WHERE secondary_category_id=$1 AND name=$2",
                    sec_id, code_name,
                )
                if code_id is None:
                    code_id = await conn.fetchval(
                        "INSERT INTO downtime_codes (secondary_category_id, name, description) "
                        "VALUES ($1, $2, $3) RETURNING id",
                        sec_id, code_name, code_desc,
                    )
                cat_codes.append(code_id)
        code_ids_by_cat[cat_idx] = cat_codes

    total_codes = sum(len(v) for v in code_ids_by_cat.values())
    print(f"  {len(TAXONOMY)} primary categories · {total_codes} reason codes")

    # ── 5. OEE targets per machine ────────────────────────────────────────────
    print("Creating OEE targets …")
    for machine_id in machine_ids:
        exists = await conn.fetchval(
            "SELECT id FROM oee_targets WHERE machine_id=$1 AND line_id IS NULL",
            machine_id,
        )
        if not exists:
            await conn.execute(
                "INSERT INTO oee_targets "
                "(machine_id, availability_target, performance_target, quality_target, oee_target) "
                "VALUES ($1, 0.90, 0.95, 0.99, 0.85)",
                machine_id,
            )

    # ── 6. Shift instances + downtime events + InfluxDB metrics ───────────────
    print("Generating 7 days of shift instances, downtime events, and OEE metrics …")

    now        = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    week_start = (now - timedelta(days=7)).replace(hour=0, minute=0, second=0, microsecond=0)

    all_lp_lines: list[str] = []
    total_instances  = 0
    total_dt_events  = 0

    for day_offset in range(7):
        day = week_start + timedelta(days=day_offset)

        # Day shift: 06:00 – 18:00 UTC
        day_s = day.replace(hour=6)
        day_e = day.replace(hour=18)

        # Night shift: 18:00 – 06:00 next day UTC
        night_s = day.replace(hour=18)
        night_e = (day + timedelta(days=1)).replace(hour=6)

        for m_idx, machine_id in enumerate(machine_ids):
            profile = PROFILES[m_idx]
            _, _, ict, _ = MACHINES_DEF[m_idx]

            for sched_id, shift_start, shift_end in [
                (day_sched_id,   day_s,   day_e),
                (night_sched_id, night_s, night_e),
            ]:
                # Skip shifts that haven't ended yet (keeps data fully historical)
                if shift_end > now:
                    continue

                # Create shift instance
                si_id = await conn.fetchval(
                    "INSERT INTO shift_instances "
                    "(schedule_id, machine_id, actual_start, actual_end, is_confirmed) "
                    "VALUES ($1, $2, $3, $4, $5) RETURNING id",
                    sched_id, machine_id, shift_start, shift_end, True,
                )
                total_instances += 1

                # Sample OEE components (consistent across the whole shift)
                avail, perf, qual = pick_oee(profile)

                # Generate downtime events
                events = generate_downtime_events(
                    profile, shift_start, shift_end, code_ids_by_cat
                )
                for ev_start, ev_end, code_id in events:
                    await conn.execute(
                        "INSERT INTO downtime_events "
                        "(machine_id, shift_instance_id, start_time, end_time, "
                        " reason_code_id, is_split) "
                        "VALUES ($1, $2, $3, $4, $5, FALSE)",
                        machine_id, si_id, ev_start, ev_end, code_id,
                    )
                total_dt_events += len(events)

                # Build InfluxDB line-protocol for this shift
                all_lp_lines.extend(
                    build_influx_lp(
                        machine_id, shift_start, shift_end,
                        avail, perf, qual, float(ict),
                    )
                )

        if (day_offset + 1) % 2 == 0:
            print(f"  … day {day_offset + 1}/7 done")

    print(f"\n  ✓ {total_instances} shift instances created")
    print(f"  ✓ {total_dt_events} downtime events created")

    # ── 7. Write all metrics to InfluxDB ──────────────────────────────────────
    print("Writing time-series OEE metrics to InfluxDB 3 …")
    influx_write(all_lp_lines)

    print("\n────────────────────────────────────────────────────────────")
    print("  ✓ WidgetCo sample data seeded successfully!")
    print("  Log in at http://localhost (admin@oeeforge.local / admin)")
    print("  Select time range '7d' on the dashboard to see all data.")
    print("────────────────────────────────────────────────────────────\n")


async def clear_sample_data(conn: asyncpg.Connection) -> None:
    """Delete all WidgetCo sample data from PostgreSQL (cascades to all related rows)."""
    site_id = await conn.fetchval("SELECT id FROM sites WHERE name = $1", SITE_NAME)
    if site_id is None:
        print("  No WidgetCo data found — nothing to clear.")
        return

    # Cascading FK deletes: sites → areas → lines → machines → shift_instances
    # → downtime_events, shift_schedules, products (separate)
    await conn.execute("DELETE FROM sites WHERE id = $1", site_id)
    # Also clear orphaned downtime taxonomy and products (no FK to site)
    for pname, sku, _ in PRODUCTS_DEF:
        await conn.execute("DELETE FROM products WHERE sku = $1", sku)
    for cat_name, _, _ in TAXONOMY:
        await conn.execute("DELETE FROM downtime_categories WHERE name = $1", cat_name)
    for sched_name in ("Day Shift", "Night Shift"):
        await conn.execute("DELETE FROM shift_schedules WHERE name = $1", sched_name)

    # Reset sequences so re-seeded IDs start from 1
    for tbl in (
        "sites", "areas", "lines", "machines",
        "shift_schedules", "shift_instances",
        "products", "machine_product_configs",
        "downtime_categories", "downtime_secondary_categories", "downtime_codes",
        "downtime_events",
    ):
        await conn.execute(f"""
            SELECT setval(
                pg_get_serial_sequence('{tbl}', 'id'),
                COALESCE((SELECT MAX(id) FROM {tbl}), 0) + 1,
                false
            )
        """)

    print("  ✓ PostgreSQL: WidgetCo data deleted.")

    # Best-effort InfluxDB cleanup for the 14-day window
    now   = datetime.now(timezone.utc)
    start = now - timedelta(days=14)
    influx_delete_range(start, now)
    print("  ✓ InfluxDB: delete request sent (best-effort).")


async def main() -> None:
    print(f"Connecting to PostgreSQL … ({DB_URL.split('@')[-1]})")
    try:
        conn = await asyncpg.connect(DB_URL)
    except Exception as exc:
        print(f"ERROR: Cannot connect to PostgreSQL: {exc}")
        sys.exit(1)

    try:
        if CLEAR:
            print("\nClearing existing WidgetCo sample data …")
            await clear_sample_data(conn)
            print("Re-seeding …")

        site_exists = await conn.fetchval(
            "SELECT id FROM sites WHERE name = $1", SITE_NAME
        )
        if site_exists and not CLEAR:
            print(
                f"\n[INFO] WidgetCo sample data already exists (site id={site_exists}).\n"
                "       Run with --clear to wipe and re-seed."
            )
            return

        await seed(conn)

    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
