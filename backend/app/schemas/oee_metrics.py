from datetime import datetime

from pydantic import BaseModel


class OEEMetricPoint(BaseModel):
    timestamp: datetime
    machine_id: str
    shift_id: str | None = None
    availability: float | None = None
    performance: float | None = None
    quality: float | None = None
    oee: float | None = None
    planned_time_seconds: int | None = None
    actual_run_time_seconds: int | None = None
    downtime_seconds: int | None = None
    total_parts: int | None = None
    good_parts: int | None = None
    reject_parts: int | None = None


class AvailabilityMetricPoint(BaseModel):
    timestamp: datetime
    machine_id: str
    value: float
    planned_time_seconds: int | None = None
    actual_run_time_seconds: int | None = None
    downtime_seconds: int | None = None
    state_running_seconds: int | None = None
    state_stopped_seconds: int | None = None
    state_faulted_seconds: int | None = None


class PerformanceMetricPoint(BaseModel):
    timestamp: datetime
    machine_id: str
    value: float
    total_parts: int | None = None
    ideal_cycle_time: float | None = None


class QualityMetricPoint(BaseModel):
    timestamp: datetime
    machine_id: str
    value: float
    total_parts: int | None = None
    good_parts: int | None = None
    reject_parts: int | None = None


class OEEQueryParams(BaseModel):
    machine_id: str | None = None
    line_id: str | None = None
    from_time: datetime | None = None
    to_time: datetime | None = None
    limit: int = 500
