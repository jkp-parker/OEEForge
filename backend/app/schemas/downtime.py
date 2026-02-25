from datetime import datetime

from pydantic import BaseModel


# ── Primary Categories ─────────────────────────────────────────────────────────

class DowntimeCategoryBase(BaseModel):
    name: str
    description: str | None = None
    counts_against_availability: bool = True


class DowntimeCategoryCreate(DowntimeCategoryBase):
    pass


class DowntimeCategoryUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    counts_against_availability: bool | None = None


class DowntimeCategoryRead(DowntimeCategoryBase):
    id: int
    model_config = {"from_attributes": True}


# ── Secondary Categories ───────────────────────────────────────────────────────

class DowntimeSecondaryCategoryBase(BaseModel):
    primary_category_id: int
    name: str
    description: str | None = None


class DowntimeSecondaryCategoryCreate(DowntimeSecondaryCategoryBase):
    pass


class DowntimeSecondaryCategoryUpdate(BaseModel):
    primary_category_id: int | None = None
    name: str | None = None
    description: str | None = None


class DowntimeSecondaryCategoryRead(DowntimeSecondaryCategoryBase):
    id: int
    model_config = {"from_attributes": True}


# ── Codes ──────────────────────────────────────────────────────────────────────

class DowntimeCodeBase(BaseModel):
    secondary_category_id: int
    name: str
    description: str | None = None


class DowntimeCodeCreate(DowntimeCodeBase):
    pass


class DowntimeCodeUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    secondary_category_id: int | None = None


class DowntimeCodeRead(DowntimeCodeBase):
    id: int
    model_config = {"from_attributes": True}


# ── Tag Configs ────────────────────────────────────────────────────────────────

class DowntimeTagConfigBase(BaseModel):
    machine_id: int
    measurement_name: str
    tag_field: str
    tag_type: str = "digital"
    digital_downtime_value: str | None = None
    analog_operator: str | None = None
    analog_threshold: float | None = None
    downtime_category_id: int | None = None
    description: str | None = None
    is_enabled: bool = True


class DowntimeTagConfigCreate(DowntimeTagConfigBase):
    pass


class DowntimeTagConfigUpdate(BaseModel):
    machine_id: int | None = None
    measurement_name: str | None = None
    tag_field: str | None = None
    tag_type: str | None = None
    digital_downtime_value: str | None = None
    analog_operator: str | None = None
    analog_threshold: float | None = None
    downtime_category_id: int | None = None
    description: str | None = None
    is_enabled: bool | None = None


class DowntimeTagConfigRead(DowntimeTagConfigBase):
    id: int
    model_config = {"from_attributes": True}


# ── Events ─────────────────────────────────────────────────────────────────────

class DowntimeEventBase(BaseModel):
    machine_id: int
    shift_instance_id: int | None = None
    start_time: datetime
    end_time: datetime | None = None
    reason_code_id: int | None = None
    comments: str | None = None
    source_tag_config_id: int | None = None
    parent_event_id: int | None = None
    is_split: bool = False


class DowntimeEventCreate(BaseModel):
    machine_id: int
    shift_instance_id: int | None = None
    start_time: datetime
    end_time: datetime | None = None
    reason_code_id: int | None = None
    comments: str | None = None


class DowntimeEventUpdate(BaseModel):
    end_time: datetime | None = None
    reason_code_id: int | None = None
    comments: str | None = None


class DowntimeEventSplit(BaseModel):
    split_time: datetime


class DowntimeEventRead(DowntimeEventBase):
    id: int
    operator_id: int | None
    created_at: datetime
    model_config = {"from_attributes": True}
