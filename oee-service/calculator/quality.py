"""Quality calculation: Good Parts / Total Parts Produced."""
from dataclasses import dataclass
from datetime import datetime


@dataclass
class QualityResult:
    machine_id: str
    shift_id: str
    window_start: datetime
    window_end: datetime
    total_parts: int
    good_parts: int
    reject_parts: int
    value: float = 0.0

    def __post_init__(self):
        if self.total_parts > 0:
            self.value = min(self.good_parts / self.total_parts, 1.0)
        else:
            self.value = 0.0


def calculate_quality(
    machine_id: str,
    shift_id: str,
    window_start: datetime,
    window_end: datetime,
    total_parts: int,
    reject_parts: int,
) -> QualityResult:
    """
    Calculate quality rate.

    Quality = Good Parts / Total Parts Produced
    Good Parts = Total Parts - Reject Parts
    """
    good_parts = max(total_parts - reject_parts, 0)
    return QualityResult(
        machine_id=machine_id,
        shift_id=shift_id,
        window_start=window_start,
        window_end=window_end,
        total_parts=total_parts,
        good_parts=good_parts,
        reject_parts=reject_parts,
    )
