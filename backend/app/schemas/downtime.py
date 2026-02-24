from datetime import datetime

from pydantic import BaseModel


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


class DowntimeCodeBase(BaseModel):
    category_id: int
    name: str
    description: str | None = None


class DowntimeCodeCreate(DowntimeCodeBase):
    pass


class DowntimeCodeUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    category_id: int | None = None


class DowntimeCodeRead(DowntimeCodeBase):
    id: int
    model_config = {"from_attributes": True}


class DowntimeEventBase(BaseModel):
    machine_id: int
    shift_instance_id: int | None = None
    start_time: datetime
    end_time: datetime | None = None
    reason_code_id: int | None = None
    comments: str | None = None


class DowntimeEventCreate(DowntimeEventBase):
    pass


class DowntimeEventUpdate(BaseModel):
    end_time: datetime | None = None
    reason_code_id: int | None = None
    comments: str | None = None


class DowntimeEventRead(DowntimeEventBase):
    id: int
    operator_id: int | None
    created_at: datetime
    model_config = {"from_attributes": True}
