from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class ExpenseCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    trip_id: str = Field(..., alias="tripId")
    category: str
    amount: float = Field(..., ge=0)
    currency: str = Field(default="CNY", min_length=3, max_length=3)
    occurred_on: date | None = Field(default=None, alias="occurredOn")


class ExpenseResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    trip_id: str = Field(..., alias="tripId")
    category: str
    amount: float
    currency: str
    occurred_on: date | None = Field(default=None, alias="occurredOn")
    created_at: datetime


class ExpenseUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    category: str | None = None
    amount: float | None = Field(default=None, ge=0)
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    occurred_on: date | None = Field(default=None, alias="occurredOn")
