from fastapi import APIRouter, Depends

from app.schemas.itinerary import ItineraryRequest, ItineraryResponse
from app.services.itinerary import ItineraryService, get_itinerary_service

router = APIRouter()


@router.post("", response_model=ItineraryResponse)
async def create_itinerary(
    payload: ItineraryRequest,
    service: ItineraryService = Depends(get_itinerary_service),
) -> ItineraryResponse:
    """Generate an itinerary and budget estimate from user intent."""

    return await service.generate_itinerary(payload)
