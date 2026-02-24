from pydantic import BaseModel


class ProductBase(BaseModel):
    name: str
    sku: str
    description: str | None = None


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    name: str | None = None
    sku: str | None = None
    description: str | None = None


class ProductRead(ProductBase):
    id: int
    model_config = {"from_attributes": True}


class MachineProductConfigBase(BaseModel):
    machine_id: int
    product_id: int
    ideal_cycle_time_seconds: float


class MachineProductConfigCreate(MachineProductConfigBase):
    pass


class MachineProductConfigUpdate(BaseModel):
    ideal_cycle_time_seconds: float | None = None


class MachineProductConfigRead(MachineProductConfigBase):
    id: int
    model_config = {"from_attributes": True}
