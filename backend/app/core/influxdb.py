"""Shared InfluxDB 3 client using the influxdb3-python library."""
import logging
from functools import lru_cache
from typing import Any

from influxdb_client_3 import InfluxDBClient3, Point  # noqa: F401

from app.core.config import settings

logger = logging.getLogger(__name__)

# InfluxDB 3 creates a database on first write.  Before any data is written the
# query layer raises a FlightInternalError whose message contains one of these
# phrases.  Treat them as "no data yet" rather than a server error.
_EMPTY_PHRASES = ("database not found", "table not found", "not found")


@lru_cache(maxsize=1)
def get_influx_client() -> InfluxDBClient3:
    return InfluxDBClient3(
        host=settings.INFLUXDB_URL,
        database=settings.INFLUXDB_DATABASE,
        token=settings.INFLUXDB_TOKEN if settings.INFLUXDB_TOKEN else None,
    )


def query_influx(sql: str) -> dict[str, Any]:
    """Execute a SQL query against InfluxDB 3 and return a column dict.

    Returns an empty dict (no rows) when the database or measurement does not
    yet exist — this is normal on a fresh stack before any OEE data has been
    written.  All other errors are re-raised so they surface as 500s.
    """
    client = get_influx_client()
    try:
        table = client.query(sql)
        return table.to_pydict() if table is not None else {}
    except Exception as exc:
        msg = str(exc).lower()
        if any(phrase in msg for phrase in _EMPTY_PHRASES):
            logger.debug("InfluxDB query returned no data (database/table not yet created): %s", exc)
            return {}
        raise


def write_influx(record: Any, write_precision: str = "ns") -> None:
    """Write a Point or line-protocol string to InfluxDB 3."""
    client = get_influx_client()
    client.write(record=record, write_precision=write_precision)
