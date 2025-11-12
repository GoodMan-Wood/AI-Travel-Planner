from __future__ import annotations

import logging
from typing import Any, AsyncGenerator

import httpx
from fastapi import Depends

from app.core.config import get_settings

logger = logging.getLogger(__name__)

BAIDU_GEOCODE_ENDPOINT = "https://api.map.baidu.com/geocoding/v3/"


class BaiduMapsClient:
    def __init__(self, *, api_key: str | None) -> None:
        self._api_key = api_key
        self._client = httpx.AsyncClient(timeout=10.0)

    @property
    def enabled(self) -> bool:
        return bool(self._api_key)

    async def close(self) -> None:
        await self._client.aclose()

    async def geocode(self, *, address: str, city: str | None = None) -> dict[str, Any] | None:
        if not self.enabled:
            return None

        params = {
            "address": address,
            "output": "json",
            "ak": self._api_key,
        }
        if city:
            params["city"] = city

        try:
            response = await self._client.get(BAIDU_GEOCODE_ENDPOINT, params=params)
            response.raise_for_status()
        except httpx.HTTPError as exc:  # pragma: no cover - network failures
            logger.warning("Baidu geocode request failed: %s", exc)
            return None

        data = response.json()
        if not isinstance(data, dict) or data.get("status") != 0:
            logger.warning("Baidu geocode returned error: %s", data)
            return None

        result = data.get("result")
        if not isinstance(result, dict):
            return None

        location = result.get("location")
        if not isinstance(location, dict):
            return None

        lat = location.get("lat")
        lng = location.get("lng")

        if lat is None or lng is None:
            return None

        return {
            "lat": float(lat),
            "lng": float(lng),
            "precise": result.get("precise"),
            "confidence": result.get("confidence"),
            "level": result.get("level"),
            "address": result.get("formatted_address") or result.get("name"),
        }


async def get_baidu_maps_client() -> AsyncGenerator[BaiduMapsClient, None]:
    settings = get_settings()
    client = BaiduMapsClient(api_key=settings.baidu_map_ak)
    try:
        yield client
    finally:
        await client.close()
