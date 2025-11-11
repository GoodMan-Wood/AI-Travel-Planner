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


class ExpenseParseRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    content: str
    trip_id: str | None = Field(default=None, alias="tripId")
    currency_hint: str | None = Field(default=None, alias="currencyHint")
    date_hint: date | None = Field(default=None, alias="dateHint")


class ExpenseParseResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    category: str | None = None
    amount: float | None = None
    currency: str | None = None
    occurred_on: date | None = Field(default=None, alias="occurredOn")
    notes: str | None = None
    confidence: float | None = None
