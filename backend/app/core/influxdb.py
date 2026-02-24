"""Shared InfluxDB 3 client using the influxdb3-python library."""
from functools import lru_cache
from typing import Any

from influxdb_client_3 import InfluxDBClient3, Point  # noqa: F401

from app.core.config import settings


@lru_cache(maxsize=1)
def get_influx_client() -> InfluxDBClient3:
    return InfluxDBClient3(
        host=settings.INFLUXDB_URL,
        database=settings.INFLUXDB_DATABASE,
        token=settings.INFLUXDB_TOKEN if settings.INFLUXDB_TOKEN else None,
    )


def query_influx(sql: str) -> list[dict[str, Any]]:
    """Execute a SQL query against InfluxDB 3 and return rows as dicts."""
    client = get_influx_client()
    table = client.query(sql)
    return table.to_pydict() if table is not None else {}


def write_influx(record: Any, write_precision: str = "ns") -> None:
    """Write a Point or line-protocol string to InfluxDB 3."""
    client = get_influx_client()
    client.write(record=record, write_precision=write_precision)
