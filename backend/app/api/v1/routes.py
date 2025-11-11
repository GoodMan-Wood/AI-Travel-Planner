from fastapi import APIRouter

from app.api.v1 import expenses, itineraries, trips

router = APIRouter()

router.include_router(itineraries.router, prefix="/itineraries", tags=["itineraries"])
router.include_router(trips.router, prefix="/trips", tags=["trips"])
router.include_router(expenses.router, prefix="/expenses", tags=["expenses"])
