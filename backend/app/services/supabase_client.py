from __future__ import annotations

import json
from typing import Any

import httpx


class SupabaseClient:
    def __init__(self, *, url: str, service_role_key: str) -> None:
        self._url = url.rstrip("/")
        self._key = service_role_key
        self._headers = {
            "apikey": service_role_key,
            "Authorization": f"Bearer {service_role_key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }

    @property
    def base_headers(self) -> dict[str, str]:
        return self._headers.copy()

    async def post(self, path: str, data: Any) -> Any:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                f"{self._url}/{path.lstrip('/')}",
                content=json.dumps(data, default=str),
                headers=self._headers,
            )
            response.raise_for_status()
            return response.json()

    async def get(self, path: str, params: dict[str, Any]) -> Any:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{self._url}/{path.lstrip('/')}",
                params=params,
                headers=self._headers,
            )
            response.raise_for_status()
            return response.json()

    async def patch(self, path: str, data: dict[str, Any]) -> Any:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.patch(
                f"{self._url}/{path.lstrip('/')}",
                content=json.dumps(data, default=str),
                headers=self._headers,
            )
            response.raise_for_status()
            return response.json()

    async def delete(self, path: str) -> Any:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.delete(
                f"{self._url}/{path.lstrip('/')}",
                headers=self._headers,
            )
            response.raise_for_status()
            if response.content:
                return response.json()
            return None
