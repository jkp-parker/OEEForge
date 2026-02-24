"""CRUD endpoints for Sites, Areas, Lines, and Machines."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db, require_admin
from app.models.organization import Area, Line, Machine, Site
from app.schemas.organization import (
    AreaCreate, AreaRead, AreaUpdate,
    LineCreate, LineRead, LineUpdate,
    MachineCreate, MachineRead, MachineUpdate,
    SiteCreate, SiteRead, SiteUpdate,
)

router = APIRouter(tags=["organization"])


# ── Sites ─────────────────────────────────────────────────────────────────────
@router.get("/sites", response_model=list[SiteRead])
async def list_sites(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    return (await db.execute(select(Site).order_by(Site.id))).scalars().all()


@router.post("/sites", response_model=SiteRead, status_code=201)
async def create_site(payload: SiteCreate, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    obj = Site(**payload.model_dump())
    db.add(obj)
    await db.flush()
    await db.refresh(obj)
    return obj


@router.get("/sites/{site_id}", response_model=SiteRead)
async def get_site(site_id: int, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    obj = await db.get(Site, site_id)
    if not obj:
        raise HTTPException(404, "Site not found")
    return obj


@router.patch("/sites/{site_id}", response_model=SiteRead)
async def update_site(site_id: int, payload: SiteUpdate, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    obj = await db.get(Site, site_id)
    if not obj:
        raise HTTPException(404, "Site not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(obj, k, v)
    await db.flush()
    await db.refresh(obj)
    return obj


@router.delete("/sites/{site_id}", status_code=204)
async def delete_site(site_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    obj = await db.get(Site, site_id)
    if not obj:
        raise HTTPException(404, "Site not found")
    await db.delete(obj)


# ── Areas ─────────────────────────────────────────────────────────────────────
@router.get("/areas", response_model=list[AreaRead])
async def list_areas(site_id: int | None = None, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    q = select(Area).order_by(Area.id)
    if site_id:
        q = q.where(Area.site_id == site_id)
    return (await db.execute(q)).scalars().all()


@router.post("/areas", response_model=AreaRead, status_code=201)
async def create_area(payload: AreaCreate, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    obj = Area(**payload.model_dump())
    db.add(obj)
    await db.flush()
    await db.refresh(obj)
    return obj


@router.patch("/areas/{area_id}", response_model=AreaRead)
async def update_area(area_id: int, payload: AreaUpdate, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    obj = await db.get(Area, area_id)
    if not obj:
        raise HTTPException(404, "Area not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(obj, k, v)
    await db.flush()
    await db.refresh(obj)
    return obj


@router.delete("/areas/{area_id}", status_code=204)
async def delete_area(area_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    obj = await db.get(Area, area_id)
    if not obj:
        raise HTTPException(404, "Area not found")
    await db.delete(obj)


# ── Lines ─────────────────────────────────────────────────────────────────────
@router.get("/lines", response_model=list[LineRead])
async def list_lines(area_id: int | None = None, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    q = select(Line).order_by(Line.id)
    if area_id:
        q = q.where(Line.area_id == area_id)
    return (await db.execute(q)).scalars().all()


@router.post("/lines", response_model=LineRead, status_code=201)
async def create_line(payload: LineCreate, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    obj = Line(**payload.model_dump())
    db.add(obj)
    await db.flush()
    await db.refresh(obj)
    return obj


@router.patch("/lines/{line_id}", response_model=LineRead)
async def update_line(line_id: int, payload: LineUpdate, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    obj = await db.get(Line, line_id)
    if not obj:
        raise HTTPException(404, "Line not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(obj, k, v)
    await db.flush()
    await db.refresh(obj)
    return obj


@router.delete("/lines/{line_id}", status_code=204)
async def delete_line(line_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    obj = await db.get(Line, line_id)
    if not obj:
        raise HTTPException(404, "Line not found")
    await db.delete(obj)


# ── Machines ──────────────────────────────────────────────────────────────────
@router.get("/machines", response_model=list[MachineRead])
async def list_machines(line_id: int | None = None, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    q = select(Machine).order_by(Machine.id)
    if line_id:
        q = q.where(Machine.line_id == line_id)
    return (await db.execute(q)).scalars().all()


@router.post("/machines", response_model=MachineRead, status_code=201)
async def create_machine(payload: MachineCreate, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    obj = Machine(**payload.model_dump())
    db.add(obj)
    await db.flush()
    await db.refresh(obj)
    return obj


@router.get("/machines/{machine_id}", response_model=MachineRead)
async def get_machine(machine_id: int, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    obj = await db.get(Machine, machine_id)
    if not obj:
        raise HTTPException(404, "Machine not found")
    return obj


@router.patch("/machines/{machine_id}", response_model=MachineRead)
async def update_machine(
    machine_id: int, payload: MachineUpdate, db: AsyncSession = Depends(get_db), _=Depends(require_admin)
):
    obj = await db.get(Machine, machine_id)
    if not obj:
        raise HTTPException(404, "Machine not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(obj, k, v)
    await db.flush()
    await db.refresh(obj)
    return obj


@router.delete("/machines/{machine_id}", status_code=204)
async def delete_machine(machine_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    obj = await db.get(Machine, machine_id)
    if not obj:
        raise HTTPException(404, "Machine not found")
    await db.delete(obj)
