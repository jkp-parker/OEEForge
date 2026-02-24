"""APScheduler job definitions for the OEE calculation service."""
import asyncio
import logging
from datetime import datetime, timedelta, timezone
from functools import lru_cache

from influxdb_client_3 import InfluxDBClient3
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from calculator.oee import run_oee_for_machine
from config import settings

logger = logging.getLogger(__name__)

_engine = None
_SessionLocal = None


def get_engine():
    global _engine, _SessionLocal
    if _engine is None:
        _engine = create_async_engine(settings.DATABASE_URL, pool_pre_ping=True)
        _SessionLocal = async_sessionmaker(_engine, class_=AsyncSession, expire_on_commit=False)
    return _engine, _SessionLocal


@lru_cache(maxsize=1)
def get_influx() -> InfluxDBClient3:
    return InfluxDBClient3(
        host=settings.INFLUXDB_URL,
        database=settings.INFLUXDB_DATABASE,
        token=settings.INFLUXDB_TOKEN if settings.INFLUXDB_TOKEN else None,
    )


async def _run_calculations():
    """Fetch all machines from Postgres and calculate OEE for each."""
    _, SessionLocal = get_engine()
    influx = get_influx()

    window_end = datetime.now(timezone.utc)
    window_start = window_end - timedelta(seconds=settings.OEE_CALC_INTERVAL_SECONDS)

    async with SessionLocal() as db:
        try:
            result = await db.execute(text("SELECT id FROM machines ORDER BY id"))
            machine_ids = [row[0] for row in result.fetchall()]
        except Exception as e:
            logger.error(f"Failed to fetch machines: {e}")
            return

    for machine_id in machine_ids:
        async with SessionLocal() as db:
            try:
                await run_oee_for_machine(
                    db=db,
                    influx=influx,
                    influx_db=settings.INFLUXDB_DATABASE,
                    machine_id=machine_id,
                    window_start=window_start,
                    window_end=window_end,
                )
                await db.commit()
            except Exception as e:
                await db.rollback()
                logger.error(f"OEE calculation failed for machine {machine_id}: {e}")


def run_calculations():
    """Synchronous wrapper for the APScheduler job."""
    asyncio.run(_run_calculations())
