from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db, require_admin
from app.models.product import MachineProductConfig, Product
from app.schemas.product import (
    MachineProductConfigCreate, MachineProductConfigRead, MachineProductConfigUpdate,
    ProductCreate, ProductRead, ProductUpdate,
)

router = APIRouter(tags=["products"])


@router.get("/products", response_model=list[ProductRead])
async def list_products(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    return (await db.execute(select(Product).order_by(Product.id))).scalars().all()


@router.post("/products", response_model=ProductRead, status_code=201)
async def create_product(payload: ProductCreate, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    obj = Product(**payload.model_dump())
    db.add(obj)
    await db.flush()
    await db.refresh(obj)
    return obj


@router.get("/products/{product_id}", response_model=ProductRead)
async def get_product(product_id: int, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    obj = await db.get(Product, product_id)
    if not obj:
        raise HTTPException(404, "Product not found")
    return obj


@router.patch("/products/{product_id}", response_model=ProductRead)
async def update_product(product_id: int, payload: ProductUpdate, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    obj = await db.get(Product, product_id)
    if not obj:
        raise HTTPException(404, "Product not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(obj, k, v)
    await db.flush()
    await db.refresh(obj)
    return obj


@router.delete("/products/{product_id}", status_code=204)
async def delete_product(product_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    obj = await db.get(Product, product_id)
    if not obj:
        raise HTTPException(404, "Product not found")
    await db.delete(obj)


# ── Machine-Product Cycle Times ───────────────────────────────────────────────
@router.get("/machine-product-configs", response_model=list[MachineProductConfigRead])
async def list_mpc(machine_id: int | None = None, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    q = select(MachineProductConfig).order_by(MachineProductConfig.id)
    if machine_id:
        q = q.where(MachineProductConfig.machine_id == machine_id)
    return (await db.execute(q)).scalars().all()


@router.post("/machine-product-configs", response_model=MachineProductConfigRead, status_code=201)
async def create_mpc(payload: MachineProductConfigCreate, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    obj = MachineProductConfig(**payload.model_dump())
    db.add(obj)
    await db.flush()
    await db.refresh(obj)
    return obj


@router.patch("/machine-product-configs/{config_id}", response_model=MachineProductConfigRead)
async def update_mpc(config_id: int, payload: MachineProductConfigUpdate, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    obj = await db.get(MachineProductConfig, config_id)
    if not obj:
        raise HTTPException(404, "Config not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(obj, k, v)
    await db.flush()
    await db.refresh(obj)
    return obj


@router.delete("/machine-product-configs/{config_id}", status_code=204)
async def delete_mpc(config_id: int, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    obj = await db.get(MachineProductConfig, config_id)
    if not obj:
        raise HTTPException(404, "Config not found")
    await db.delete(obj)
