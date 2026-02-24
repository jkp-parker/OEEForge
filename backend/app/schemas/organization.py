from pydantic import BaseModel


# ── Site ──────────────────────────────────────────────────────────────────────
class SiteBase(BaseModel):
    name: str
    description: str | None = None
    timezone: str = "UTC"


class SiteCreate(SiteBase):
    pass


class SiteUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    timezone: str | None = None


class SiteRead(SiteBase):
    id: int
    model_config = {"from_attributes": True}


# ── Area ──────────────────────────────────────────────────────────────────────
class AreaBase(BaseModel):
    site_id: int
    name: str
    description: str | None = None


class AreaCreate(AreaBase):
    pass


class AreaUpdate(BaseModel):
    name: str | None = None
    description: str | None = None


class AreaRead(AreaBase):
    id: int
    model_config = {"from_attributes": True}


# ── Line ──────────────────────────────────────────────────────────────────────
class LineBase(BaseModel):
    area_id: int
    name: str
    description: str | None = None


class LineCreate(LineBase):
    pass


class LineUpdate(BaseModel):
    name: str | None = None
    description: str | None = None


class LineRead(LineBase):
    id: int
    model_config = {"from_attributes": True}


# ── Machine ───────────────────────────────────────────────────────────────────
class MachineBase(BaseModel):
    line_id: int
    name: str
    description: str | None = None
    opcua_node_id: str | None = None


class MachineCreate(MachineBase):
    pass


class MachineUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    opcua_node_id: str | None = None


class MachineRead(MachineBase):
    id: int
    model_config = {"from_attributes": True}
