from fastapi import APIRouter

from app.api import auth, downtime, oee_config, oee_metrics, organization, products, shifts, users

api_router = APIRouter(prefix="/api")

api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(organization.router)
api_router.include_router(shifts.router)
api_router.include_router(products.router)
api_router.include_router(downtime.router)
api_router.include_router(oee_config.router)
api_router.include_router(oee_metrics.router)
