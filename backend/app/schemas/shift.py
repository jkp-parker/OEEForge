from datetime import datetime, time

from pydantic import BaseModel


class ShiftScheduleBase(BaseModel):
    site_id: int
    name: str
    start_time: time
    end_time: time
    days_of_week: list[int]
    is_active: bool = True


class ShiftScheduleCreate(ShiftScheduleBase):
    pass


class ShiftScheduleUpdate(BaseModel):
    name: str | None = None
    start_time: time | None = None
    end_time: time | None = None
    days_of_week: list[int] | None = None
    is_active: bool | None = None


class ShiftScheduleRead(ShiftScheduleBase):
    id: int
    model_config = {"from_attributes": True}


class ShiftInstanceBase(BaseModel):
    schedule_id: int
    machine_id: int
    actual_start: datetime
    actual_end: datetime | None = None
    operator_id: int | None = None
    is_confirmed: bool = False


class ShiftInstanceCreate(ShiftInstanceBase):
    pass


class ShiftInstanceUpdate(BaseModel):
    actual_end: datetime | None = None
    operator_id: int | None = None
    is_confirmed: bool | None = None


class ShiftInstanceRead(ShiftInstanceBase):
    id: int
    created_at: datetime
    model_config = {"from_attributes": True}
