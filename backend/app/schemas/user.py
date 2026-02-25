from datetime import datetime

from pydantic import BaseModel, EmailStr


class UserBase(BaseModel):
    username: str
    email: str
    role: str = "operator"
    line_id: int | None = None
    is_active: bool = True


class UserCreate(UserBase):
    email: EmailStr  # strict validation only on creation
    password: str


class UserUpdate(BaseModel):
    username: str | None = None
    email: str | None = None
    role: str | None = None
    line_id: int | None = None
    is_active: bool | None = None
    password: str | None = None


class UserRead(UserBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
