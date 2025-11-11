from __future__ import annotations

from pydantic import BaseModel, Field, ConfigDict


class BudgetItem(BaseModel):
    category: str = Field(..., description="Budget category such as transport or dining")
    amount: float = Field(..., ge=0)


class Budget(BaseModel):
    total: float = Field(..., ge=0)
    currency: str = Field(default="CNY", max_length=3)
    breakdown: list[BudgetItem] = Field(default_factory=list)


class ItineraryResponse(BaseModel):
    itinerary: str = Field(..., description="Generated itinerary in markdown format")
    budget: Budget
    trip_id: str | None = Field(default=None, alias="tripId")


class ItineraryRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    intent: str = Field(..., min_length=10, description="Natural language travel intent")
    locale: str = Field(default="zh-CN")
    currency: str = Field(default="CNY")
    user_id: str | None = Field(default=None, alias="userId")
