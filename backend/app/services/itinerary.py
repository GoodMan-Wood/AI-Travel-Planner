from __future__ import annotations

import asyncio
import re
from typing import Protocol

from fastapi import Depends

from app.schemas.itinerary import Budget, BudgetItem, ItineraryRequest, ItineraryResponse
from app.services.llm import LLMClient, get_llm_client
from app.services.prompt import build_itinerary_prompt
from app.services.trip_repository import TripRepository, get_trip_repository


class SpeechClient(Protocol):
    async def transcribe(self, audio_bytes: bytes) -> str: ...  # pragma: no cover


class ItineraryService:
    def __init__(self, llm_client: LLMClient, trip_repository: TripRepository | None = None) -> None:
        self._llm_client = llm_client
        self._trip_repository = trip_repository

    async def generate_itinerary(self, payload: ItineraryRequest) -> ItineraryResponse:
        prompt = build_itinerary_prompt(intent=payload.intent, locale=payload.locale)
        llm_result = await self._llm_client.complete(prompt)

        # Placeholder parsing logic until schema-based responses are implemented.
        itinerary_text = llm_result.get("itinerary", "行程规划暂未生成，请稍后重试。")
        budget_data = llm_result.get("budget", {})

        breakdown = [
            BudgetItem(category=item.get("category", "未知"), amount=float(item.get("amount", 0)))
            for item in budget_data.get("breakdown", [])
        ]

        budget = Budget(
            total=float(budget_data.get("total", 0)),
            currency=budget_data.get("currency", payload.currency),
            breakdown=breakdown,
        )

        trip_id = None
        if payload.user_id and self._trip_repository and self._trip_repository.enabled:
            trip_id = await self._trip_repository.save_trip(
                user_id=payload.user_id,
                intent=payload.intent,
                itinerary=itinerary_text,
                budget={
                    "total": budget.total,
                    "currency": budget.currency,
                    "breakdown": [item.model_dump() for item in budget.breakdown],
                },
            )

        return ItineraryResponse(itinerary=itinerary_text, budget=budget, trip_id=trip_id)


def _extract_locations_from_prompt(prompt: str) -> list[str]:
    itinerary_text = prompt.split("行程文本:", 1)[1].strip() if "行程文本:" in prompt else prompt
    lines = [line.strip().lstrip("- ") for line in itinerary_text.splitlines() if line.strip()]
    verbs = [
        "带孩子前往",
        "带孩子去",
        "前往",
        "参观",
        "游览",
        "游玩",
        "探索",
        "抵达",
        "入住",
        "逛",
        "体验",
        "造访",
    ]
    suffixes = [
        "附近酒店",
        "酒店",
        "主题餐厅",
        "餐厅",
        "附近",
        "游玩一整天",
        "游玩",
        "探索",
        "体验",
        "纪念品",
        "返程",
        "享用寿司",
        "游逛",
        "商店",
        "纪念品店",
    ]
    trailing_descriptors = ["动漫", "主题", "亲子", "体验", "路线"]

    locations: list[str] = []
    seen: set[str] = set()

    for line in lines:
        content = line.split("：", 1)[1].strip() if "：" in line else line
        segments = [segment.strip() for segment in re.split(r"[，,。；;]", content) if segment.strip()]

        for segment in segments:
            phrase = segment
            for verb in verbs:
                if verb in phrase:
                    phrase = phrase.split(verb, 1)[1]
                    break
            phrase = phrase.strip()
            if phrase.startswith(("在", "于")):
                phrase = phrase[1:].strip()
            if not phrase:
                continue

            for suffix in suffixes:
                if phrase.endswith(suffix) and len(phrase) > len(suffix):
                    phrase = phrase[: -len(suffix)].strip()

            phrase = phrase.strip("- 第天日1234567890")
            if not phrase:
                continue

            match = re.search(r"[A-Za-z\u4e00-\u9fff·]{2,20}", phrase)
            candidate = match.group(0).strip() if match else phrase
            candidate = candidate.strip("第天日1234567890")
            for descriptor in trailing_descriptors:
                if candidate.endswith(descriptor) and len(candidate) > len(descriptor):
                    candidate = candidate[: -len(descriptor)].strip()

            if len(candidate) < 2:
                continue

            if not candidate or candidate in seen:
                continue

            seen.add(candidate)
            locations.append(candidate)
            if len(locations) >= 12:
                return locations

    return locations


def _guess_primary_city(itinerary_text: str, locations: list[str]) -> str | None:
    patterns = [
        r"抵达(?P<city>[A-Za-z\u4e00-\u9fff·]{2,20})",
        r"到达(?P<city>[A-Za-z\u4e00-\u9fff·]{2,20})",
        r"入住(?P<city>[A-Za-z\u4e00-\u9fff·]{2,20})",
        r"前往(?P<city>[A-Za-z\u4e00-\u9fff·]{2,20})",
    ]

    for pattern in patterns:
        match = re.search(pattern, itinerary_text)
        if match:
            city = match.group("city").strip("，。、. \n")
            if city:
                return city

    for location in locations:
        candidate = location.strip()
        if len(candidate) >= 2:
            return candidate

    return None


async def default_llm_response(prompt: str) -> dict[str, object]:
    """Fallback LLM response used when provider credentials are absent."""

    await asyncio.sleep(0.1)

    if "\"locations\"" in prompt and "行程文本" in prompt:
        itinerary_text = prompt.split("行程文本:", 1)[1].strip() if "行程文本:" in prompt else prompt
        locations = _extract_locations_from_prompt(prompt)
        city = _guess_primary_city(itinerary_text, locations)
        return {"locations": locations, "city": city}

    return {
        "itinerary": "1. 抵达并办理入住\n2. 探索城市主要景点\n3. 品尝当地特色美食",
        "budget": {
            "total": 8000,
            "currency": "CNY",
            "breakdown": [
                {"category": "交通", "amount": 2000},
                {"category": "住宿", "amount": 3000},
                {"category": "餐饮", "amount": 1500},
                {"category": "游玩", "amount": 1500},
            ],
        },
    }


class MockLLMClient:
    async def complete(self, prompt: str) -> dict[str, object]:
        return await default_llm_response(prompt)


def get_itinerary_service(
    llm_client: LLMClient = Depends(get_llm_client),
    trip_repository: TripRepository = Depends(get_trip_repository),
) -> ItineraryService:
    return ItineraryService(llm_client=llm_client, trip_repository=trip_repository)
