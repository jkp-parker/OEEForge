"""CRUD for OEE targets and per-component machine configurations."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db, require_admin
from app.models.oee_config import (
    MachineAvailabilityConfig,
    MachinePerformanceConfig,
    MachineQualityConfig,
    OEETarget,
    RejectEvent,
)
from app.models.user import User
from app.schemas.oee_config import (
    MachineAvailabilityConfigCreate, MachineAvailabilityConfigRead, MachineAvailabilityConfigUpdate,
    MachinePerformanceConfigCreate, MachinePerformanceConfigRead, MachinePerformanceConfigUpdate,
    MachineQualityConfigCreate, MachineQualityConfigRead, MachineQualityConfigUpdate,
    OEETargetCreate, OEETargetRead, OEETargetUpdate,
    RejectEventCreate, RejectEventRead,
)

router = APIRouter(tags=["oee-config"])


# ── OEE Targets ───────────────────────────────────────────────────────────────
@router.get("/oee-targets", response_model=list[OEETargetRead])
async def list_targets(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    return (await db.execute(select(OEETarget).order_by(OEETarget.id))).scalars().all()


@router.post("/oee-targets", response_model=OEETargetRead, status_code=201)
async def create_target(payload: OEETargetCreate, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    obj = OEETarget(**payload.model_dump())
    db.add(obj)
    await db.flush()
    await db.refresh(obj)
    return obj


@router.patch("/oee-targets/{target_id}", response_model=OEETargetRead)
async def update_target(target_id: int, payload: OEETargetUpdate, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    obj = await db.get(OEETarget, target_id)
    if not obj:
        raise HTTPException(404, "Target not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(obj, k, v)
    await db.flush()
    await db.refresh(obj)
    return obj


@router.delete("/oee-targets/{target_id}", status_code=204)
async def delete_target(target_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    obj = await db.get(OEETarget, target_id)
    if not obj:
        raise HTTPException(404, "Target not found")
    await db.delete(obj)


# ── Availability Config ───────────────────────────────────────────────────────
@router.get("/availability-configs", response_model=list[MachineAvailabilityConfigRead])
async def list_avail_configs(machine_id: int | None = None, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    q = select(MachineAvailabilityConfig).order_by(MachineAvailabilityConfig.id)
    if machine_id:
        q = q.where(MachineAvailabilityConfig.machine_id == machine_id)
    return (await db.execute(q)).scalars().all()


@router.post("/availability-configs", response_model=MachineAvailabilityConfigRead, status_code=201)
async def create_avail_config(payload: MachineAvailabilityConfigCreate, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    obj = MachineAvailabilityConfig(**payload.model_dump())
    db.add(obj)
    await db.flush()
    await db.refresh(obj)
    return obj


@router.patch("/availability-configs/{config_id}", response_model=MachineAvailabilityConfigRead)
async def update_avail_config(config_id: int, payload: MachineAvailabilityConfigUpdate, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    obj = await db.get(MachineAvailabilityConfig, config_id)
    if not obj:
        raise HTTPException(404, "Config not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(obj, k, v)
    await db.flush()
    await db.refresh(obj)
    return obj


@router.delete("/availability-configs/{config_id}", status_code=204)
async def delete_avail_config(config_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    obj = await db.get(MachineAvailabilityConfig, config_id)
    if not obj:
        raise HTTPException(404, "Config not found")
    await db.delete(obj)


# ── Performance Config ────────────────────────────────────────────────────────
@router.get("/performance-configs", response_model=list[MachinePerformanceConfigRead])
async def list_perf_configs(machine_id: int | None = None, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    q = select(MachinePerformanceConfig).order_by(MachinePerformanceConfig.id)
    if machine_id:
        q = q.where(MachinePerformanceConfig.machine_id == machine_id)
    return (await db.execute(q)).scalars().all()


@router.post("/performance-configs", response_model=MachinePerformanceConfigRead, status_code=201)
async def create_perf_config(payload: MachinePerformanceConfigCreate, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    obj = MachinePerformanceConfig(**payload.model_dump())
    db.add(obj)
    await db.flush()
    await db.refresh(obj)
    return obj


@router.patch("/performance-configs/{config_id}", response_model=MachinePerformanceConfigRead)
async def update_perf_config(config_id: int, payload: MachinePerformanceConfigUpdate, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    obj = await db.get(MachinePerformanceConfig, config_id)
    if not obj:
        raise HTTPException(404, "Config not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(obj, k, v)
    await db.flush()
    await db.refresh(obj)
    return obj


@router.delete("/performance-configs/{config_id}", status_code=204)
async def delete_perf_config(config_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    obj = await db.get(MachinePerformanceConfig, config_id)
    if not obj:
        raise HTTPException(404, "Config not found")
    await db.delete(obj)


# ── Quality Config ────────────────────────────────────────────────────────────
@router.get("/quality-configs", response_model=list[MachineQualityConfigRead])
async def list_qual_configs(machine_id: int | None = None, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    q = select(MachineQualityConfig).order_by(MachineQualityConfig.id)
    if machine_id:
        q = q.where(MachineQualityConfig.machine_id == machine_id)
    return (await db.execute(q)).scalars().all()


@router.post("/quality-configs", response_model=MachineQualityConfigRead, status_code=201)
async def create_qual_config(payload: MachineQualityConfigCreate, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    obj = MachineQualityConfig(**payload.model_dump())
    db.add(obj)
    await db.flush()
    await db.refresh(obj)
    return obj


@router.patch("/quality-configs/{config_id}", response_model=MachineQualityConfigRead)
async def update_qual_config(config_id: int, payload: MachineQualityConfigUpdate, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    obj = await db.get(MachineQualityConfig, config_id)
    if not obj:
        raise HTTPException(404, "Config not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(obj, k, v)
    await db.flush()
    await db.refresh(obj)
    return obj


@router.delete("/quality-configs/{config_id}", status_code=204)
async def delete_qual_config(config_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    obj = await db.get(MachineQualityConfig, config_id)
    if not obj:
        raise HTTPException(404, "Config not found")
    await db.delete(obj)


# ── Reject Events ─────────────────────────────────────────────────────────────
@router.get("/reject-events", response_model=list[RejectEventRead])
async def list_reject_events(
    machine_id: int | None = None,
    shift_instance_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    q = select(RejectEvent).order_by(RejectEvent.timestamp.desc())
    if machine_id:
        q = q.where(RejectEvent.machine_id == machine_id)
    if shift_instance_id:
        q = q.where(RejectEvent.shift_instance_id == shift_instance_id)
    return (await db.execute(q)).scalars().all()


@router.post("/reject-events", response_model=RejectEventRead, status_code=201)
async def create_reject_event(
    payload: RejectEventCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    obj = RejectEvent(**payload.model_dump(), operator_id=current_user.id)
    db.add(obj)
    await db.flush()
    await db.refresh(obj)
    return obj


@router.delete("/reject-events/{event_id}", status_code=204)
async def delete_reject_event(event_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    obj = await db.get(RejectEvent, event_id)
    if not obj:
        raise HTTPException(404, "Reject event not found")
    await db.delete(obj)
