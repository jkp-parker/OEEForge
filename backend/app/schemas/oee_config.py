from datetime import datetime

from pydantic import BaseModel


# ── OEE Target ────────────────────────────────────────────────────────────────
class OEETargetBase(BaseModel):
    machine_id: int | None = None
    line_id: int | None = None
    availability_target: float = 0.90
    performance_target: float = 0.95
    quality_target: float = 0.99
    oee_target: float = 0.85


class OEETargetCreate(OEETargetBase):
    pass


class OEETargetUpdate(BaseModel):
    availability_target: float | None = None
    performance_target: float | None = None
    quality_target: float | None = None
    oee_target: float | None = None


class OEETargetRead(OEETargetBase):
    id: int
    model_config = {"from_attributes": True}


# ── Availability Config ────────────────────────────────────────────────────────
class MachineAvailabilityConfigBase(BaseModel):
    machine_id: int
    state_tag: str | None = None
    running_value: str | None = None
    stopped_value: str | None = None
    faulted_value: str | None = None
    idle_value: str | None = None
    changeover_value: str | None = None
    planned_downtime_value: str | None = None
    excluded_category_ids: list[int] = []
    planned_production_time_seconds: int | None = None


class MachineAvailabilityConfigCreate(MachineAvailabilityConfigBase):
    pass


class MachineAvailabilityConfigUpdate(BaseModel):
    state_tag: str | None = None
    running_value: str | None = None
    stopped_value: str | None = None
    faulted_value: str | None = None
    idle_value: str | None = None
    changeover_value: str | None = None
    planned_downtime_value: str | None = None
    excluded_category_ids: list[int] | None = None
    planned_production_time_seconds: int | None = None


class MachineAvailabilityConfigRead(MachineAvailabilityConfigBase):
    id: int
    model_config = {"from_attributes": True}


# ── Performance Config ────────────────────────────────────────────────────────
class MachinePerformanceConfigBase(BaseModel):
    machine_id: int
    product_id: int | None = None
    ideal_cycle_time_seconds: float
    rated_speed: float | None = None
    cycle_count_tag: str | None = None
    minor_stoppage_threshold_seconds: int = 120


class MachinePerformanceConfigCreate(MachinePerformanceConfigBase):
    pass


class MachinePerformanceConfigUpdate(BaseModel):
    ideal_cycle_time_seconds: float | None = None
    rated_speed: float | None = None
    cycle_count_tag: str | None = None
    minor_stoppage_threshold_seconds: int | None = None


class MachinePerformanceConfigRead(MachinePerformanceConfigBase):
    id: int
    model_config = {"from_attributes": True}


# ── Quality Config ────────────────────────────────────────────────────────────
class MachineQualityConfigBase(BaseModel):
    machine_id: int
    product_id: int | None = None
    good_parts_tag: str | None = None
    reject_parts_tag: str | None = None
    manual_reject_entry: bool = False
    cost_per_unit: float | None = None
    quality_target: float = 0.99


class MachineQualityConfigCreate(MachineQualityConfigBase):
    pass


class MachineQualityConfigUpdate(BaseModel):
    good_parts_tag: str | None = None
    reject_parts_tag: str | None = None
    manual_reject_entry: bool | None = None
    cost_per_unit: float | None = None
    quality_target: float | None = None


class MachineQualityConfigRead(MachineQualityConfigBase):
    id: int
    model_config = {"from_attributes": True}


# ── Reject Event ──────────────────────────────────────────────────────────────
class RejectEventBase(BaseModel):
    machine_id: int
    shift_instance_id: int | None = None
    timestamp: datetime
    reject_count: int = 1
    reason_code_id: int | None = None
    is_manual: bool = True
    comments: str | None = None


class RejectEventCreate(RejectEventBase):
    pass


class RejectEventRead(RejectEventBase):
    id: int
    operator_id: int | None
    created_at: datetime
    model_config = {"from_attributes": True}
