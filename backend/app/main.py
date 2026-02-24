from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from app.api.router import api_router
from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.core.security import hash_password
from app.models import *  # noqa: F401,F403 — ensures all models are registered


@asynccontextmanager
async def lifespan(app: FastAPI):
    await _create_first_admin()
    yield


async def _create_first_admin():
    """Create the default admin user on first start if it doesn't exist."""
    from app.models.user import User

    async with AsyncSessionLocal() as db:
        try:
            result = await db.execute(select(User).where(User.email == settings.FIRST_ADMIN_EMAIL))
            if result.scalar_one_or_none() is None:
                admin = User(
                    username="admin",
                    email=settings.FIRST_ADMIN_EMAIL,
                    hashed_password=hash_password(settings.FIRST_ADMIN_PASSWORD),
                    role="admin",
                )
                db.add(admin)
                await db.commit()
        except Exception:
            await db.rollback()


app = FastAPI(
    title="OEEForge API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/health")
async def health():
    return {"status": "ok"}
