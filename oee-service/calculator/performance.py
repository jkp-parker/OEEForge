"""Performance calculation: (Ideal Cycle Time × Total Parts) / Actual Run Time."""
from dataclasses import dataclass
from datetime import datetime


@dataclass
class PerformanceResult:
    machine_id: str
    shift_id: str
    window_start: datetime
    window_end: datetime
    total_parts: int
    ideal_cycle_time_seconds: float
    actual_run_time_seconds: float
    value: float = 0.0

    def __post_init__(self):
        if self.actual_run_time_seconds > 0 and self.ideal_cycle_time_seconds > 0:
            self.value = min(
                (self.ideal_cycle_time_seconds * self.total_parts) / self.actual_run_time_seconds,
                1.0,
            )
        else:
            self.value = 0.0


def calculate_performance(
    machine_id: str,
    shift_id: str,
    window_start: datetime,
    window_end: datetime,
    total_parts: int,
    ideal_cycle_time_seconds: float,
    actual_run_time_seconds: float,
) -> PerformanceResult:
    """
    Calculate performance efficiency.

    Performance = (Ideal Cycle Time × Total Parts Produced) / Actual Run Time
    """
    return PerformanceResult(
        machine_id=machine_id,
        shift_id=shift_id,
        window_start=window_start,
        window_end=window_end,
        total_parts=total_parts,
        ideal_cycle_time_seconds=ideal_cycle_time_seconds,
        actual_run_time_seconds=actual_run_time_seconds,
    )
