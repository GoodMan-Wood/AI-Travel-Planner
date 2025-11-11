from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Path, Query

from app.schemas.trip import TripDetailResponse, TripResponse
from app.services.trip_repository import TripRepository, get_trip_repository

router = APIRouter()


@router.get("", response_model=list[TripResponse])
async def list_trips(
    user_id: str = Query(..., alias="userId"),
    limit: int = Query(default=20, ge=1, le=100),
    repository: TripRepository = Depends(get_trip_repository),
) -> list[TripResponse]:
    if not repository.enabled:
        raise HTTPException(status_code=503, detail="Trip storage not configured")

    return await repository.fetch_trips(user_id=user_id, limit=limit)


@router.get("/{trip_id}", response_model=TripDetailResponse)
async def get_trip_detail(
    trip_id: str = Path(..., description="Trip identifier"),
    user_id: str = Query(..., alias="userId"),
    repository: TripRepository = Depends(get_trip_repository),
) -> TripDetailResponse:
    if not repository.enabled:
        raise HTTPException(status_code=503, detail="Trip storage not configured")

    trip = await repository.fetch_trip_detail(user_id=user_id, trip_id=trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    return trip
