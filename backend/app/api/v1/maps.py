from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query

from app.schemas.map import TripMapResponse
from app.services.trip_map import TripMapService, get_trip_map_service

router = APIRouter()


@router.get("/trips/{trip_id}", response_model=TripMapResponse)
async def get_trip_map(
    trip_id: str,
    user_id: str = Query(..., alias="userId"),
    service: TripMapService = Depends(get_trip_map_service),
) -> TripMapResponse:
    if not user_id:
        raise HTTPException(status_code=400, detail="userId is required")

    if not service.maps_enabled:
        raise HTTPException(status_code=503, detail="Baidu map service is not configured")

    return await service.build_trip_map(user_id=user_id, trip_id=trip_id)
