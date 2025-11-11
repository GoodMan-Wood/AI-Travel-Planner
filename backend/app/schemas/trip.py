from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.expense import ExpenseResponse


class TripResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    title: str
    intent: str
    generated_itinerary: str | None = None
    total_budget: float | None = None
    currency: str | None = None
    created_at: datetime
    budget_breakdown: list[dict[str, Any]] | None = None


class TripDetailResponse(TripResponse):
    updated_at: datetime | None = None
    total_expenses: float | None = None
    remaining_budget: float | None = None
    expenses: list[ExpenseResponse] = Field(default_factory=list)
