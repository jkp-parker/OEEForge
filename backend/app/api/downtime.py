from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db, require_admin
from app.models.downtime import (
    DowntimeCategory,
    DowntimeCode,
    DowntimeEvent,
    DowntimeSecondaryCategory,
    DowntimeTagConfig,
)
from app.models.user import User
from app.schemas.downtime import (
    DowntimeCategoryCreate,
    DowntimeCategoryRead,
    DowntimeCategoryUpdate,
    DowntimeCodeCreate,
    DowntimeCodeRead,
    DowntimeCodeUpdate,
    DowntimeEventCreate,
    DowntimeEventRead,
    DowntimeEventSplit,
    DowntimeEventUpdate,
    DowntimeSecondaryCategoryCreate,
    DowntimeSecondaryCategoryRead,
    DowntimeSecondaryCategoryUpdate,
    DowntimeTagConfigCreate,
    DowntimeTagConfigRead,
    DowntimeTagConfigUpdate,
)

router = APIRouter(tags=["downtime"])


# ── Primary Categories ─────────────────────────────────────────────────────────

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


# ── Secondary Categories ───────────────────────────────────────────────────────

@router.get("/downtime-secondary-categories", response_model=list[DowntimeSecondaryCategoryRead])
async def list_secondary_categories(
    primary_category_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    q = select(DowntimeSecondaryCategory).order_by(DowntimeSecondaryCategory.id)
    if primary_category_id:
        q = q.where(DowntimeSecondaryCategory.primary_category_id == primary_category_id)
    return (await db.execute(q)).scalars().all()


@router.post("/downtime-secondary-categories", response_model=DowntimeSecondaryCategoryRead, status_code=201)
async def create_secondary_category(
    payload: DowntimeSecondaryCategoryCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin),
):
    obj = DowntimeSecondaryCategory(**payload.model_dump())
    db.add(obj)
    await db.flush()
    await db.refresh(obj)
    return obj


@router.patch("/downtime-secondary-categories/{sec_id}", response_model=DowntimeSecondaryCategoryRead)
async def update_secondary_category(
    sec_id: int,
    payload: DowntimeSecondaryCategoryUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin),
):
    obj = await db.get(DowntimeSecondaryCategory, sec_id)
    if not obj:
        raise HTTPException(404, "Secondary category not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(obj, k, v)
    await db.flush()
    await db.refresh(obj)
    return obj


@router.delete("/downtime-secondary-categories/{sec_id}", status_code=204)
async def delete_secondary_category(sec_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    obj = await db.get(DowntimeSecondaryCategory, sec_id)
    if not obj:
        raise HTTPException(404, "Secondary category not found")
    await db.delete(obj)


# ── Codes ──────────────────────────────────────────────────────────────────────

@router.get("/downtime-codes", response_model=list[DowntimeCodeRead])
async def list_codes(
    secondary_category_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    q = select(DowntimeCode).order_by(DowntimeCode.id)
    if secondary_category_id:
        q = q.where(DowntimeCode.secondary_category_id == secondary_category_id)
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


# ── Tag Configs ────────────────────────────────────────────────────────────────

@router.get("/downtime-tag-configs", response_model=list[DowntimeTagConfigRead])
async def list_tag_configs(
    machine_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    q = select(DowntimeTagConfig).order_by(DowntimeTagConfig.id)
    if machine_id:
        q = q.where(DowntimeTagConfig.machine_id == machine_id)
    return (await db.execute(q)).scalars().all()


@router.post("/downtime-tag-configs", response_model=DowntimeTagConfigRead, status_code=201)
async def create_tag_config(
    payload: DowntimeTagConfigCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin),
):
    obj = DowntimeTagConfig(**payload.model_dump())
    db.add(obj)
    await db.flush()
    await db.refresh(obj)
    return obj


@router.patch("/downtime-tag-configs/{config_id}", response_model=DowntimeTagConfigRead)
async def update_tag_config(
    config_id: int,
    payload: DowntimeTagConfigUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin),
):
    obj = await db.get(DowntimeTagConfig, config_id)
    if not obj:
        raise HTTPException(404, "Tag config not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(obj, k, v)
    await db.flush()
    await db.refresh(obj)
    return obj


@router.delete("/downtime-tag-configs/{config_id}", status_code=204)
async def delete_tag_config(config_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    obj = await db.get(DowntimeTagConfig, config_id)
    if not obj:
        raise HTTPException(404, "Tag config not found")
    await db.delete(obj)


# ── Events ─────────────────────────────────────────────────────────────────────

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
async def update_event(
    event_id: int,
    payload: DowntimeEventUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    obj = await db.get(DowntimeEvent, event_id)
    if not obj:
        raise HTTPException(404, "Event not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(obj, k, v)
    await db.flush()
    await db.refresh(obj)
    return obj


@router.post("/downtime-events/{event_id}/split", response_model=DowntimeEventRead, status_code=201)
async def split_event(
    event_id: int,
    payload: DowntimeEventSplit,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    obj = await db.get(DowntimeEvent, event_id)
    if not obj:
        raise HTTPException(404, "Event not found")
    if obj.end_time is None:
        raise HTTPException(400, "Cannot split an ongoing event (no end time)")

    split_time = payload.split_time
    # Normalize to UTC-aware if needed
    if split_time.tzinfo is None:
        split_time = split_time.replace(tzinfo=timezone.utc)

    if split_time <= obj.start_time:
        raise HTTPException(400, "split_time must be after the event start_time")
    if split_time >= obj.end_time:
        raise HTTPException(400, "split_time must be before the event end_time")

    original_end = obj.end_time

    # Trim original event to the split point
    obj.end_time = split_time

    # Create the second half
    second = DowntimeEvent(
        machine_id=obj.machine_id,
        shift_instance_id=obj.shift_instance_id,
        start_time=split_time,
        end_time=original_end,
        parent_event_id=obj.id,
        is_split=True,
        operator_id=obj.operator_id,
    )
    db.add(second)
    await db.flush()
    await db.refresh(second)
    return second


@router.delete("/downtime-events/{event_id}", status_code=204)
async def delete_event(event_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    obj = await db.get(DowntimeEvent, event_id)
    if not obj:
        raise HTTPException(404, "Event not found")
    await db.delete(obj)
