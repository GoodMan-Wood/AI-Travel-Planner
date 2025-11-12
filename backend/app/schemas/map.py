from __future__ import annotations

from pydantic import BaseModel, Field


class MapPoint(BaseModel):
    name: str
    lat: float
    lng: float
    address: str | None = None
    sourceText: str | None = None
    confidence: float | None = None


class MapCoordinate(BaseModel):
    lat: float
    lng: float


class MapSegment(BaseModel):
    startIndex: int
    endIndex: int
    coordinates: list[MapCoordinate] = Field(default_factory=list)


class TripMapResponse(BaseModel):
    tripId: str
    city: str | None = None
    points: list[MapPoint]
    segments: list[MapSegment] = Field(default_factory=list)