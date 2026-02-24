"""Orchestrates the full OEE calculation and writes results to InfluxDB 3."""
import logging
from datetime import datetime, timezone

from influxdb_client_3 import InfluxDBClient3, Point
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from calculator.availability import calculate_availability
from calculator.performance import calculate_performance
from calculator.quality import calculate_quality

logger = logging.getLogger(__name__)


async def run_oee_for_machine(
    db: AsyncSession,
    influx: InfluxDBClient3,
    influx_db: str,
    machine_id: int,
    window_start: datetime,
    window_end: datetime,
) -> None:
    """Calculate and write OEE components for one machine over a time window."""
    machine_id_str = str(machine_id)
    shift_id = f"{window_start.strftime('%Y%m%d%H%M')}"

    # ── 1. Fetch availability config ──────────────────────────────────────────
    avail_cfg_result = await db.execute(
        text("SELECT * FROM machine_availability_configs WHERE machine_id = :mid"),
        {"mid": machine_id},
    )
    avail_cfg = avail_cfg_result.mappings().first()

    # ── 2. Fetch performance config ───────────────────────────────────────────
    perf_cfg_result = await db.execute(
        text(
            "SELECT * FROM machine_performance_configs "
            "WHERE machine_id = :mid AND product_id IS NULL "
            "ORDER BY id LIMIT 1"
        ),
        {"mid": machine_id},
    )
    perf_cfg = perf_cfg_result.mappings().first()

    # ── 3. Fetch quality config ───────────────────────────────────────────────
    qual_cfg_result = await db.execute(
        text(
            "SELECT * FROM machine_quality_configs "
            "WHERE machine_id = :mid AND product_id IS NULL "
            "ORDER BY id LIMIT 1"
        ),
        {"mid": machine_id},
    )
    qual_cfg = qual_cfg_result.mappings().first()

    # ── 4. Query InfluxDB for machine state during window ─────────────────────
    state_durations: dict[str, float] = {}
    total_parts = 0
    reject_parts = 0

    iso_start = window_start.isoformat()
    iso_end = window_end.isoformat()

    try:
        # State data
        state_sql = f"""
            SELECT state, SUM(duration_seconds) AS total_duration
            FROM machine_state
            WHERE machine_id = '{machine_id_str}'
              AND time >= '{iso_start}' AND time < '{iso_end}'
            GROUP BY state
        """
        state_table = influx.query(state_sql)
        if state_table is not None:
            state_dict = state_table.to_pydict()
            states = state_dict.get("state", [])
            durations = state_dict.get("total_duration", [])
            for s, d in zip(states, durations):
                if s and d is not None:
                    state_durations[str(s).lower()] = float(d)

        # Part count data
        parts_sql = f"""
            SELECT MAX(total_count) AS max_count, MAX(reject_count) AS max_reject
            FROM production_count
            WHERE machine_id = '{machine_id_str}'
              AND time >= '{iso_start}' AND time < '{iso_end}'
        """
        parts_table = influx.query(parts_sql)
        if parts_table is not None:
            parts_dict = parts_table.to_pydict()
            max_counts = parts_dict.get("max_count", [0])
            max_rejects = parts_dict.get("max_reject", [0])
            total_parts = int(max_counts[0] or 0) if max_counts else 0
            reject_parts = int(max_rejects[0] or 0) if max_rejects else 0

    except Exception as e:
        logger.warning(f"InfluxDB query failed for machine {machine_id}: {e}")

    # ── 5. Derive planned time ─────────────────────────────────────────────────
    window_seconds = (window_end - window_start).total_seconds()
    planned_time = float(
        avail_cfg["planned_production_time_seconds"] if avail_cfg and avail_cfg["planned_production_time_seconds"]
        else window_seconds
    )

    # ── 6. Calculate each component ───────────────────────────────────────────
    avail_result = calculate_availability(
        machine_id=machine_id_str,
        shift_id=shift_id,
        window_start=window_start,
        window_end=window_end,
        state_durations=state_durations,
        planned_time_seconds=planned_time,
    )

    ideal_cycle_time = float(perf_cfg["ideal_cycle_time_seconds"]) if perf_cfg else 1.0
    perf_result = calculate_performance(
        machine_id=machine_id_str,
        shift_id=shift_id,
        window_start=window_start,
        window_end=window_end,
        total_parts=total_parts,
        ideal_cycle_time_seconds=ideal_cycle_time,
        actual_run_time_seconds=avail_result.actual_run_time_seconds,
    )

    qual_result = calculate_quality(
        machine_id=machine_id_str,
        shift_id=shift_id,
        window_start=window_start,
        window_end=window_end,
        total_parts=total_parts,
        reject_parts=reject_parts,
    )

    oee_value = avail_result.value * perf_result.value * qual_result.value
    timestamp = window_end

    # ── 7. Write to InfluxDB ──────────────────────────────────────────────────
    try:
        # Combined OEE metric
        oee_point = (
            Point("oee_metrics")
            .tag("machine_id", machine_id_str)
            .tag("shift_id", shift_id)
            .field("availability", round(avail_result.value, 4))
            .field("performance", round(perf_result.value, 4))
            .field("quality", round(qual_result.value, 4))
            .field("oee", round(oee_value, 4))
            .field("planned_time_seconds", int(avail_result.planned_time_seconds))
            .field("actual_run_time_seconds", int(avail_result.actual_run_time_seconds))
            .field("downtime_seconds", int(avail_result.downtime_seconds))
            .field("total_parts", total_parts)
            .field("good_parts", qual_result.good_parts)
            .field("reject_parts", reject_parts)
            .time(timestamp)
        )

        # Availability breakdown
        avail_point = (
            Point("availability_metrics")
            .tag("machine_id", machine_id_str)
            .tag("shift_id", shift_id)
            .field("value", round(avail_result.value, 4))
            .field("planned_time_seconds", int(avail_result.planned_time_seconds))
            .field("actual_run_time_seconds", int(avail_result.actual_run_time_seconds))
            .field("downtime_seconds", int(avail_result.downtime_seconds))
            .field("state_running_seconds", int(avail_result.state_running_seconds))
            .field("state_stopped_seconds", int(avail_result.state_stopped_seconds))
            .field("state_faulted_seconds", int(avail_result.state_faulted_seconds))
            .time(timestamp)
        )

        # Performance breakdown
        perf_point = (
            Point("performance_metrics")
            .tag("machine_id", machine_id_str)
            .tag("shift_id", shift_id)
            .field("value", round(perf_result.value, 4))
            .field("total_parts", total_parts)
            .field("ideal_cycle_time", ideal_cycle_time)
            .field("actual_run_time_seconds", int(avail_result.actual_run_time_seconds))
            .time(timestamp)
        )

        # Quality breakdown
        qual_point = (
            Point("quality_metrics")
            .tag("machine_id", machine_id_str)
            .tag("shift_id", shift_id)
            .field("value", round(qual_result.value, 4))
            .field("total_parts", total_parts)
            .field("good_parts", qual_result.good_parts)
            .field("reject_parts", reject_parts)
            .time(timestamp)
        )

        for point in [oee_point, avail_point, perf_point, qual_point]:
            influx.write(record=point, write_precision="ns")

        logger.info(
            f"Machine {machine_id_str}: OEE={oee_value:.1%} "
            f"A={avail_result.value:.1%} P={perf_result.value:.1%} Q={qual_result.value:.1%}"
        )

    except Exception as e:
        logger.error(f"Failed to write OEE metrics for machine {machine_id}: {e}")
