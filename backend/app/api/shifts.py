from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db, require_admin
from app.models.shift import ShiftInstance, ShiftSchedule
from app.schemas.shift import (
    ShiftInstanceCreate, ShiftInstanceRead, ShiftInstanceUpdate,
    ShiftScheduleCreate, ShiftScheduleRead, ShiftScheduleUpdate,
)

router = APIRouter(tags=["shifts"])


# ── Schedules ─────────────────────────────────────────────────────────────────
@router.get("/shift-schedules", response_model=list[ShiftScheduleRead])
async def list_schedules(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    return (await db.execute(select(ShiftSchedule).order_by(ShiftSchedule.id))).scalars().all()


@router.post("/shift-schedules", response_model=ShiftScheduleRead, status_code=201)
async def create_schedule(payload: ShiftScheduleCreate, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    obj = ShiftSchedule(**payload.model_dump())
    db.add(obj)
    await db.flush()
    await db.refresh(obj)
    return obj


@router.get("/shift-schedules/{schedule_id}", response_model=ShiftScheduleRead)
async def get_schedule(schedule_id: int, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    obj = await db.get(ShiftSchedule, schedule_id)
    if not obj:
        raise HTTPException(404, "Schedule not found")
    return obj


@router.patch("/shift-schedules/{schedule_id}", response_model=ShiftScheduleRead)
async def update_schedule(
    schedule_id: int, payload: ShiftScheduleUpdate, db: AsyncSession = Depends(get_db), _=Depends(require_admin)
):
    obj = await db.get(ShiftSchedule, schedule_id)
    if not obj:
        raise HTTPException(404, "Schedule not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(obj, k, v)
    await db.flush()
    await db.refresh(obj)
    return obj


@router.delete("/shift-schedules/{schedule_id}", status_code=204)
async def delete_schedule(schedule_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    obj = await db.get(ShiftSchedule, schedule_id)
    if not obj:
        raise HTTPException(404, "Schedule not found")
    await db.delete(obj)


# ── Instances ─────────────────────────────────────────────────────────────────
@router.get("/shift-instances", response_model=list[ShiftInstanceRead])
async def list_instances(
    machine_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    q = select(ShiftInstance).order_by(ShiftInstance.actual_start.desc())
    if machine_id:
        q = q.where(ShiftInstance.machine_id == machine_id)
    return (await db.execute(q)).scalars().all()


@router.post("/shift-instances", response_model=ShiftInstanceRead, status_code=201)
async def create_instance(payload: ShiftInstanceCreate, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    obj = ShiftInstance(**payload.model_dump())
    db.add(obj)
    await db.flush()
    await db.refresh(obj)
    return obj


@router.patch("/shift-instances/{instance_id}", response_model=ShiftInstanceRead)
async def update_instance(
    instance_id: int, payload: ShiftInstanceUpdate, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)
):
    obj = await db.get(ShiftInstance, instance_id)
    if not obj:
        raise HTTPException(404, "Instance not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(obj, k, v)
    await db.flush()
    await db.refresh(obj)
    return obj
