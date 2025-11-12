from __future__ import annotations

from fastapi import Depends

from app.schemas.map import MapCoordinate, MapPoint, MapSegment, TripMapResponse
from app.services.baidu_maps import BaiduMapsClient, get_baidu_maps_client
from app.services.llm import LLMClient, get_llm_client
from app.services.prompt import build_itinerary_locations_prompt
from app.services.trip_repository import TripRepository, get_trip_repository


class TripMapService:
    def __init__(
        self,
        *,
        trip_repository: TripRepository,
        maps_client: BaiduMapsClient,
        llm_client: LLMClient | None = None,
    ) -> None:
        self._trip_repository = trip_repository
        self._maps_client = maps_client
        self._llm_client = llm_client

    @property
    def maps_enabled(self) -> bool:
        return self._maps_client.enabled

    async def build_trip_map(self, *, user_id: str, trip_id: str) -> TripMapResponse:
        if not self._maps_client.enabled:
            return TripMapResponse(tripId=trip_id, points=[])

        trip = await self._trip_repository.fetch_trip_detail(user_id=user_id, trip_id=trip_id)
        if not trip or not trip.generated_itinerary:
            return TripMapResponse(tripId=trip_id, points=[])

        locations, city = await self._extract_locations(itinerary=trip.generated_itinerary)

        if not locations:
            return TripMapResponse(tripId=trip_id, city=city, points=[])

        points: list[MapPoint] = []
        for location_name in locations:
            point = await self._geocode_location(name=location_name, city=city)
            if point is not None:
                points.append(point)

        segments: list[MapSegment] = []
        if len(points) >= 2:
            for index in range(len(points) - 1):
                start = points[index]
                end = points[index + 1]
                segments.append(
                    MapSegment(
                        startIndex=index,
                        endIndex=index + 1,
                        coordinates=[
                            MapCoordinate(lat=start.lat, lng=start.lng),
                            MapCoordinate(lat=end.lat, lng=end.lng),
                        ],
                    )
                )

        return TripMapResponse(tripId=trip_id, city=city, points=points, segments=segments)

    async def _extract_locations(self, *, itinerary: str) -> tuple[list[str], str | None]:
        if self._llm_client is None:
            return [], None

        prompt = build_itinerary_locations_prompt(itinerary=itinerary)
        try:
            llm_result = await self._llm_client.complete(prompt)
        except Exception:  # pragma: no cover - LLM failures
            return [], None

        raw_locations = []
        city: str | None = None
        if isinstance(llm_result, dict):
            candidate = llm_result.get("locations")
            if isinstance(candidate, list):
                raw_locations = candidate
            city_candidate = llm_result.get("city")
            if isinstance(city_candidate, str):
                stripped = city_candidate.strip()
                if stripped:
                    city = stripped
            elif city_candidate is None:
                city = None

        locations: list[str] = []
        for item in raw_locations:
            if isinstance(item, str):
                name = item.strip()
            elif isinstance(item, dict):
                name = str(item.get("name", "")).strip()
            else:
                continue

            if name:
                locations.append(name)

        return locations, city

    async def _geocode_location(
        self,
        *,
        name: str,
        city: str | None,
    ) -> MapPoint | None:
        geocode = await self._maps_client.geocode(address=name, city=city)
        if not geocode:
            return None

        confidence_raw = geocode.get("confidence")
        confidence = float(confidence_raw) / 100 if isinstance(confidence_raw, (int, float)) else None

        return MapPoint(
            name=name,
            lat=geocode["lat"],
            lng=geocode["lng"],
            address=geocode.get("address"),
            sourceText=name,
            confidence=confidence,
        )


def get_trip_map_service(
    trip_repository: TripRepository = Depends(get_trip_repository),
    maps_client: BaiduMapsClient = Depends(get_baidu_maps_client),
    llm_client: LLMClient = Depends(get_llm_client),
) -> TripMapService:
    return TripMapService(
        trip_repository=trip_repository,
        maps_client=maps_client,
        llm_client=llm_client,
    )
