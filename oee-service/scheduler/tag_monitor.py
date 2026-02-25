"""Tag monitor: auto-create/close downtime events based on InfluxDB field conditions."""
import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy import text

from config import settings
from scheduler.tasks import get_engine, get_influx

logger = logging.getLogger(__name__)


def _evaluate_condition(value, tag_type: str, digital_downtime_value: str | None,
                        analog_operator: str | None, analog_threshold: float | None) -> bool:
    """Return True if the tag value indicates a downtime condition."""
    if tag_type == "digital":
        return str(value) == digital_downtime_value
    elif tag_type == "analog" and analog_operator and analog_threshold is not None:
        try:
            numeric = float(value)
        except (TypeError, ValueError):
            return False
        ops = {
            ">": numeric > analog_threshold,
            ">=": numeric >= analog_threshold,
            "<": numeric < analog_threshold,
            "<=": numeric <= analog_threshold,
            "==": numeric == analog_threshold,
        }
        return ops.get(analog_operator, False)
    return False


async def _run_tag_monitor():
    """Check InfluxDB tag conditions and auto-create/close downtime events."""
    _, SessionLocal = get_engine()
    influx = get_influx()
    now = datetime.now(timezone.utc)

    async with SessionLocal() as db:
        try:
            result = await db.execute(
                text(
                    """
                    SELECT id, machine_id, measurement_name, tag_field, tag_type,
                           digital_downtime_value, analog_operator, analog_threshold,
                           downtime_category_id
                    FROM downtime_tag_configs
                    WHERE is_enabled = true
                    ORDER BY id
                    """
                )
            )
            configs = result.fetchall()
        except Exception as e:
            logger.error(f"Tag monitor: failed to fetch configs: {e}")
            return

    for cfg in configs:
        (cfg_id, machine_id, measurement_name, tag_field, tag_type,
         digital_downtime_value, analog_operator, analog_threshold,
         downtime_category_id) = cfg

        # Query InfluxDB for the latest value of this field for this machine
        sql = (
            f'SELECT "{tag_field}", time '
            f'FROM "{measurement_name}" '
            f"WHERE \"machine_id\" = '{machine_id}' "
            f"ORDER BY time DESC "
            f"LIMIT 1"
        )
        try:
            table = influx.query(sql, database=settings.INFLUXDB_DATABASE, language="sql")
            if table is None or len(table) == 0:
                continue
            value = table[tag_field][0].as_py() if hasattr(table[tag_field][0], "as_py") else table[tag_field][0]
        except Exception as e:
            logger.debug(f"Tag monitor: no data for config {cfg_id} (machine {machine_id}): {e}")
            continue

        is_down = _evaluate_condition(
            value, tag_type, digital_downtime_value, analog_operator, analog_threshold
        )

        async with SessionLocal() as db:
            try:
                if is_down:
                    # Check for an existing open event for this config
                    existing = await db.execute(
                        text(
                            "SELECT id FROM downtime_events "
                            "WHERE source_tag_config_id = :cfg_id AND end_time IS NULL "
                            "ORDER BY start_time DESC LIMIT 1"
                        ),
                        {"cfg_id": cfg_id},
                    )
                    if existing.fetchone() is None:
                        # Create a new downtime event
                        await db.execute(
                            text(
                                "INSERT INTO downtime_events "
                                "(machine_id, start_time, source_tag_config_id, is_split, created_at) "
                                "VALUES (:machine_id, :start_time, :cfg_id, false, :created_at)"
                            ),
                            {
                                "machine_id": machine_id,
                                "start_time": now,
                                "cfg_id": cfg_id,
                                "created_at": now,
                            },
                        )
                        await db.commit()
                        logger.info(f"Tag monitor: opened downtime event for config {cfg_id} (machine {machine_id})")
                else:
                    # Close any open event for this config
                    result = await db.execute(
                        text(
                            "SELECT id FROM downtime_events "
                            "WHERE source_tag_config_id = :cfg_id AND end_time IS NULL "
                            "ORDER BY start_time DESC LIMIT 1"
                        ),
                        {"cfg_id": cfg_id},
                    )
                    row = result.fetchone()
                    if row:
                        await db.execute(
                            text(
                                "UPDATE downtime_events SET end_time = :end_time WHERE id = :event_id"
                            ),
                            {"end_time": now, "event_id": row[0]},
                        )
                        await db.commit()
                        logger.info(f"Tag monitor: closed downtime event {row[0]} for config {cfg_id}")
            except Exception as e:
                await db.rollback()
                logger.error(f"Tag monitor: DB error for config {cfg_id}: {e}")


def run_tag_monitor():
    """Synchronous wrapper for APScheduler."""
    asyncio.run(_run_tag_monitor())
