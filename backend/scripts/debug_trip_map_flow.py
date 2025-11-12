from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path
from textwrap import dedent
from typing import Any

import httpx

from app.core.config import get_settings
from app.schemas.map import MapCoordinate, MapSegment, TripMapResponse
from app.services.baidu_maps import BAIDU_GEOCODE_ENDPOINT, BaiduMapsClient
from app.services.itinerary import MockLLMClient
from app.services.llm import ModelScopeLLMClient, get_llm_client
from app.services.prompt import build_itinerary_locations_prompt
from app.services.trip_map import TripMapService


class _NullTripRepository:
	"""Placeholder repository so the map service can be instantiated."""

	async def fetch_trip_detail(self, *args: Any, **kwargs: Any) -> Any:  # pragma: no cover - debug helper
		raise NotImplementedError("Trip repository is not used in debug script")


class DebugBaiduMapsClient(BaiduMapsClient):
	async def geocode(self, *, address: str, city: str | None = None) -> dict[str, Any] | None:
		print("\n--- Baidu Geocode Request ---")
		print(json.dumps({"address": address, "city": city}, ensure_ascii=False, indent=2))

		if not self.enabled:
			print("Baidu Maps client disabled (missing BAIDU_MAP_AK). Skipping request.")
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
		except httpx.HTTPError as exc:  # pragma: no cover - network failure path
			print(f"HTTP request failed: {exc}")
			return None

		print(f"HTTP status: {response.status_code}")
		print("Response body:")
		print(response.text)

		try:
			response.raise_for_status()
		except httpx.HTTPStatusError as exc:
			print(f"HTTP status error: {exc}")
			return None

		try:
			data = response.json()
		except ValueError:
			print("Failed to decode JSON response.")
			return None

		print("Parsed JSON:")
		print(json.dumps(data, ensure_ascii=False, indent=2))

		if not isinstance(data, dict) or data.get("status") != 0:
			print("Baidu geocode reported an error status.")
			return None

		result = data.get("result")
		if not isinstance(result, dict):
			print("Unexpected result payload.")
			return None

		location = result.get("location")
		if not isinstance(location, dict):
			print("Missing location field in result.")
			return None

		lat = location.get("lat")
		lng = location.get("lng")
		if lat is None or lng is None:
			print("Missing latitude or longitude in response.")
			return None

		parsed: dict[str, Any] = {
			"lat": float(lat),
			"lng": float(lng),
			"precise": result.get("precise"),
			"confidence": result.get("confidence"),
			"level": result.get("level"),
			"address": result.get("formatted_address") or result.get("name"),
		}

		print("Sanitized geocode result:")
		print(json.dumps(parsed, ensure_ascii=False, indent=2))
		return parsed


async def _extract_locations_with_logging(service: TripMapService, itinerary: str) -> tuple[list[str], str | None]:
	prompt = build_itinerary_locations_prompt(itinerary=itinerary)
	print("--- Prompt Sent To LLM ---")
	print(dedent(prompt))
	print("--- End Prompt ---\n")

	if service._llm_client is None:  # type: ignore[attr-defined]
		print("LLM client not configured; returning empty list.")
		return [], None

	try:
		llm_raw = await service._llm_client.complete(prompt)  # type: ignore[attr-defined]
	except Exception as exc:  # pragma: no cover - LLM failure path
		print(f"LLM call failed: {exc}")
		return [], None

	print("--- Raw LLM Response ---")
	try:
		print(json.dumps(llm_raw, ensure_ascii=False, indent=2))
	except TypeError:
		print(f"Non-serializable LLM output: {llm_raw}")
	print("--- End LLM Response ---\n")

	locations: list[str] = []
	city: str | None = None

	if isinstance(llm_raw, dict):
		candidate = llm_raw.get("locations")
		if isinstance(candidate, list):
			for item in candidate:
				name: str | None = None
				if isinstance(item, str):
					name = item.strip()
				elif isinstance(item, dict):
					value = item.get("name")
					if isinstance(value, str):
						name = value.strip()

				if name:
					locations.append(name)

		city_candidate = llm_raw.get("city")
		if isinstance(city_candidate, str):
			stripped = city_candidate.strip()
			if stripped:
				city = stripped
		elif city_candidate is None:
			city = None

	print("Extracted locations (ordered):")
	for idx, location in enumerate(locations, start=1):
		print(f"  {idx}. {location}")
	print(f"Detected primary city: {city or '未识别'}")

	return locations, city


def _create_llm_client(args: argparse.Namespace):
	if args.api_key:
		try:
			return ModelScopeLLMClient(api_key=args.api_key, base_url=args.llm_base_url, model=args.llm_model)
		except Exception as exc:
			print(f"Failed to initialize LLM client with provided API key: {exc}")
			sys.exit(2)

	return get_llm_client()


async def debug_flow(itinerary: str, args: argparse.Namespace) -> TripMapResponse:
	settings = get_settings()
	llm_client = _create_llm_client(args)
	maps_api_key = args.baidu_ak or settings.baidu_map_ak
	maps_client = DebugBaiduMapsClient(api_key=maps_api_key)

	service = TripMapService(
		trip_repository=_NullTripRepository(),
		maps_client=maps_client,
		llm_client=llm_client,
	)

	print(f"Using LLM client: {llm_client.__class__.__name__}")
	print(f"Baidu Maps enabled: {maps_client.enabled}")

	if isinstance(llm_client, MockLLMClient) and not args.allow_mock:
		print(
			"Detected MockLLMClient. Set MODELSCOPE_API_KEY / OPENAI_API_KEY or use --api-key to call a real model."
		)
		print("Use --allow-mock to continue with mock responses.")
		await maps_client.close()
		sys.exit(3)

	try:
		locations, city = await _extract_locations_with_logging(service, itinerary)

		points = []
		for location in locations:
			print(f"\n=== Geocoding location: {location} ===")
			point = await service._geocode_location(name=location, city=city)
			print("Map point result:")
			if point is None:
				print("  Geocoding failed; no point produced.")
			else:
				print(json.dumps(point.model_dump(), ensure_ascii=False, indent=2))
				points.append(point)

		segments: list[MapSegment] = []
		if len(points) >= 2:
			for idx in range(len(points) - 1):
				start = points[idx]
				end = points[idx + 1]
				segment = MapSegment(
					startIndex=idx,
					endIndex=idx + 1,
					coordinates=[
						MapCoordinate(lat=start.lat, lng=start.lng),
						MapCoordinate(lat=end.lat, lng=end.lng),
					],
				)
				segments.append(segment)

		response = TripMapResponse(tripId="debug-trip", city=city, points=points, segments=segments)
		print("\n=== Final TripMapResponse ===")
		print(json.dumps(response.model_dump(), ensure_ascii=False, indent=2))
		return response
	finally:
		await maps_client.close()


def _load_itinerary(args: argparse.Namespace) -> str:
	if args.itinerary:
		return args.itinerary

	if args.itinerary_file:
		path = Path(args.itinerary_file)
		content = path.read_text(encoding="utf-8").strip()
		if not content:
			raise ValueError("Itinerary file is empty")
		return content

	raise ValueError("An itinerary string or file path must be provided.")


async def _async_main(args: argparse.Namespace) -> None:
	try:
		itinerary = _load_itinerary(args)
	except Exception as exc:
		print(f"Failed to load itinerary: {exc}")
		sys.exit(1)

	print("=== Debugging Trip Map Flow ===")
	print("Itinerary input:")
	print(itinerary)

	await debug_flow(itinerary, args)


def main(argv: list[str] | None = None) -> None:
	parser = argparse.ArgumentParser(description="Debug the itinerary-to-map pipeline.")
	parser.add_argument(
		"--itinerary",
		type=str,
		help="Itinerary text to process."
	)
	parser.add_argument(
		"--itinerary-file",
		type=str,
		help="Path to a file containing the itinerary."
	)
	parser.add_argument(
		"--api-key",
		type=str,
		help="Override the LLM API key used for requests."
	)
	parser.add_argument(
		"--llm-base-url",
		type=str,
		help="Override the LLM service base URL."
	)
	parser.add_argument(
		"--llm-model",
		type=str,
		help="Override the LLM model identifier."
	)
	parser.add_argument(
		"--allow-mock",
		action="store_true",
		help="Allow running with the mock LLM client if no API key is configured."
	)
	parser.add_argument(
		"--baidu-ak",
		type=str,
		help="Override the Baidu Maps API key used for geocoding."
	)

	args = parser.parse_args(argv)

	asyncio.run(_async_main(args))


if __name__ == "__main__":
	main()
