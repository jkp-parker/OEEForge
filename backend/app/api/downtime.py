from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db, require_admin
from app.models.downtime import DowntimeCategory, DowntimeCode, DowntimeEvent
from app.models.user import User
from app.schemas.downtime import (
    DowntimeCategoryCreate, DowntimeCategoryRead, DowntimeCategoryUpdate,
    DowntimeCodeCreate, DowntimeCodeRead, DowntimeCodeUpdate,
    DowntimeEventCreate, DowntimeEventRead, DowntimeEventUpdate,
)

router = APIRouter(tags=["downtime"])


# ── Categories ────────────────────────────────────────────────────────────────
@router.get("/downtime-categories", response_model=list[DowntimeCategoryRead])
async def list_categories(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    return (await db.execute(select(DowntimeCategory).order_by(DowntimeCategory.id))).scalars().all()


@router.post("/downtime-categories", response_model=DowntimeCategoryRead, status_code=201)
async def create_category(payload: DowntimeCategoryCreate, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    obj = DowntimeCategory(**payload.model_dump())
    db.add(obj)
    await db.flush()
    await db.refresh(obj)
    return obj


@router.patch("/downtime-categories/{cat_id}", response_model=DowntimeCategoryRead)
async def update_category(cat_id: int, payload: DowntimeCategoryUpdate, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    obj = await db.get(DowntimeCategory, cat_id)
    if not obj:
        raise HTTPException(404, "Category not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(obj, k, v)
    await db.flush()
    await db.refresh(obj)
    return obj


@router.delete("/downtime-categories/{cat_id}", status_code=204)
async def delete_category(cat_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    obj = await db.get(DowntimeCategory, cat_id)
    if not obj:
        raise HTTPException(404, "Category not found")
    await db.delete(obj)


# ── Codes ─────────────────────────────────────────────────────────────────────
@router.get("/downtime-codes", response_model=list[DowntimeCodeRead])
async def list_codes(category_id: int | None = None, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    q = select(DowntimeCode).order_by(DowntimeCode.id)
    if category_id:
        q = q.where(DowntimeCode.category_id == category_id)
    return (await db.execute(q)).scalars().all()


@router.post("/downtime-codes", response_model=DowntimeCodeRead, status_code=201)
async def create_code(payload: DowntimeCodeCreate, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    obj = DowntimeCode(**payload.model_dump())
    db.add(obj)
    await db.flush()
    await db.refresh(obj)
    return obj


@router.patch("/downtime-codes/{code_id}", response_model=DowntimeCodeRead)
async def update_code(code_id: int, payload: DowntimeCodeUpdate, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    obj = await db.get(DowntimeCode, code_id)
    if not obj:
        raise HTTPException(404, "Code not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(obj, k, v)
    await db.flush()
    await db.refresh(obj)
    return obj


@router.delete("/downtime-codes/{code_id}", status_code=204)
async def delete_code(code_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    obj = await db.get(DowntimeCode, code_id)
    if not obj:
        raise HTTPException(404, "Code not found")
    await db.delete(obj)


# ── Events ────────────────────────────────────────────────────────────────────
@router.get("/downtime-events", response_model=list[DowntimeEventRead])
async def list_events(
    machine_id: int | None = None,
    shift_instance_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    q = select(DowntimeEvent).order_by(DowntimeEvent.start_time.desc())
    if machine_id:
        q = q.where(DowntimeEvent.machine_id == machine_id)
    if shift_instance_id:
        q = q.where(DowntimeEvent.shift_instance_id == shift_instance_id)
    return (await db.execute(q)).scalars().all()


@router.post("/downtime-events", response_model=DowntimeEventRead, status_code=201)
async def create_event(
    payload: DowntimeEventCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    obj = DowntimeEvent(**payload.model_dump(), operator_id=current_user.id)
    db.add(obj)
    await db.flush()
    await db.refresh(obj)
    return obj


@router.patch("/downtime-events/{event_id}", response_model=DowntimeEventRead)
async def update_event(event_id: int, payload: DowntimeEventUpdate, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    obj = await db.get(DowntimeEvent, event_id)
    if not obj:
        raise HTTPException(404, "Event not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(obj, k, v)
    await db.flush()
    await db.refresh(obj)
    return obj


@router.delete("/downtime-events/{event_id}", status_code=204)
async def delete_event(event_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    obj = await db.get(DowntimeEvent, event_id)
    if not obj:
        raise HTTPException(404, "Event not found")
    await db.delete(obj)
