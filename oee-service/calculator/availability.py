"""Availability calculation: Actual Run Time / Planned Production Time."""
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class AvailabilityResult:
    machine_id: str
    shift_id: str
    window_start: datetime
    window_end: datetime
    planned_time_seconds: float
    actual_run_time_seconds: float
    downtime_seconds: float
    state_running_seconds: float = 0.0
    state_stopped_seconds: float = 0.0
    state_faulted_seconds: float = 0.0
    state_idle_seconds: float = 0.0
    state_changeover_seconds: float = 0.0
    state_planned_downtime_seconds: float = 0.0
    value: float = 0.0

    def __post_init__(self):
        if self.planned_time_seconds > 0:
            self.value = min(self.actual_run_time_seconds / self.planned_time_seconds, 1.0)
        else:
            self.value = 0.0


def calculate_availability(
    machine_id: str,
    shift_id: str,
    window_start: datetime,
    window_end: datetime,
    state_durations: dict[str, float],
    planned_time_seconds: float,
    excluded_state_seconds: float = 0.0,
) -> AvailabilityResult:
    """
    Calculate availability from machine state durations.

    Args:
        state_durations: dict mapping state names (running/stopped/faulted/idle/
                         changeover/planned_downtime) to seconds spent in that state.
        planned_time_seconds: Total planned production time for the window.
        excluded_state_seconds: Seconds in states that should NOT count against availability
                                (e.g. planned maintenance categories configured as excluded).
    """
    running = state_durations.get("running", 0.0)
    stopped = state_durations.get("stopped", 0.0)
    faulted = state_durations.get("faulted", 0.0)
    idle = state_durations.get("idle", 0.0)
    changeover = state_durations.get("changeover", 0.0)
    planned_dt = state_durations.get("planned_downtime", 0.0)

    # Downtime = all non-running, non-excluded time
    unplanned_downtime = stopped + faulted + idle + changeover
    total_downtime = unplanned_downtime - excluded_state_seconds

    # Effective planned time excludes planned downtime and excluded categories
    effective_planned = max(planned_time_seconds - planned_dt - excluded_state_seconds, 0.0)
    actual_run = max(effective_planned - max(total_downtime, 0.0), 0.0)

    return AvailabilityResult(
        machine_id=machine_id,
        shift_id=shift_id,
        window_start=window_start,
        window_end=window_end,
        planned_time_seconds=effective_planned,
        actual_run_time_seconds=actual_run,
        downtime_seconds=max(total_downtime, 0.0),
        state_running_seconds=running,
        state_stopped_seconds=stopped,
        state_faulted_seconds=faulted,
        state_idle_seconds=idle,
        state_changeover_seconds=changeover,
        state_planned_downtime_seconds=planned_dt,
    )
