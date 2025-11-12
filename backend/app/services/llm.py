from __future__ import annotations

import json
import os
from typing import Protocol

try:
    from openai import AsyncOpenAI
except ImportError:  # pragma: no cover
    AsyncOpenAI = None  # type: ignore


class LLMClient(Protocol):
    async def complete(self, prompt: str) -> dict[str, object]: ...  # pragma: no cover


DEFAULT_MODELSCOPE_BASE_URL = "https://api-inference.modelscope.cn/v1"
DEFAULT_MODELSCOPE_MODEL_ID = "deepseek-ai/DeepSeek-V3.1"


class ModelScopeLLMClient:
    def __init__(
        self,
        api_key: str,
        *,
        base_url: str | None = None,
        model: str | None = None,
    ) -> None:
        if AsyncOpenAI is None:  # pragma: no cover - dependency optional in tests
            raise RuntimeError("openai package is not available")

        effective_base_url = base_url or os.getenv("MODELSCOPE_BASE_URL") or DEFAULT_MODELSCOPE_BASE_URL
        effective_model = model or os.getenv("MODELSCOPE_MODEL_ID") or DEFAULT_MODELSCOPE_MODEL_ID

        self._client = AsyncOpenAI(api_key=api_key, base_url=effective_base_url)
        self._model = effective_model

    async def complete(self, prompt: str) -> dict[str, object]:
        response = await self._client.chat.completions.create(
            model=self._model,
            messages=[
                {
                    "role": "system",
                    "content": "你是帮用户规划旅行的智能助手，请返回 JSON 格式的行程与预算。",
                },
                {"role": "user", "content": prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.3,
        )

        choice = response.choices[0] if response.choices else None
        content = choice.message.content if choice else None  # type: ignore[assignment]
        if not content:
            return {}

        return json.loads(content)


def get_llm_client() -> LLMClient:
    api_key = os.getenv("MODELSCOPE_API_KEY") or os.getenv("OPENAI_API_KEY")
    if not api_key:
        from app.services.itinerary import MockLLMClient

        return MockLLMClient()

    base_url = os.getenv("MODELSCOPE_BASE_URL")
    model_id = os.getenv("MODELSCOPE_MODEL_ID")

    return ModelScopeLLMClient(api_key=api_key, base_url=base_url, model=model_id)
