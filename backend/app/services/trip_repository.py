from __future__ import annotations

from typing import Any

from app.core.config import get_settings
from app.schemas.expense import ExpenseResponse
from app.schemas.trip import TripDetailResponse, TripResponse
from app.services.supabase_client import SupabaseClient


class TripRepository:
    def __init__(self, *, supabase_url: str | None, service_role_key: str | None) -> None:
        self._client: SupabaseClient | None = None
        if supabase_url and service_role_key:
            self._client = SupabaseClient(url=supabase_url, service_role_key=service_role_key)

    @property
    def enabled(self) -> bool:
        return self._client is not None

    async def _fetch_trip_row(self, trip_id: str, user_id: str | None = None) -> dict[str, Any] | None:
        if not self._client:
            return None

        params: dict[str, Any] = {"id": f"eq.{trip_id}", "limit": 1}
        if user_id:
            params["owner_id"] = f"eq.{user_id}"

        try:
            rows = await self._client.get("rest/v1/trips", params)
        except Exception:
            return None

        if isinstance(rows, list) and rows:
            return rows[0]
        return None

    async def _fetch_expense_row(self, expense_id: str) -> dict[str, Any] | None:
        if not self._client:
            return None

        params = {
            "id": f"eq.{expense_id}",
            "select": "*,trip:trips(id,owner_id,total_budget)",
            "limit": 1,
        }

        try:
            rows = await self._client.get("rest/v1/expenses", params)
        except Exception:
            return None

        if isinstance(rows, list) and rows:
            return rows[0]
        return None

    async def save_trip(
        self,
        *,
        user_id: str,
        intent: str,
        itinerary: str,
        budget: dict[str, Any] | None,
    ) -> str | None:
        if not self._client:
            return None

        title = intent.strip().split("\n", 1)[0][:60] or "AI 旅行计划"

        budget_total = budget.get("total") if budget else None
        budget_currency = budget.get("currency") if budget else None
        budget_breakdown = budget.get("breakdown") if budget else None

        payload = {
            "owner_id": user_id,
            "title": title,
            "intent": intent,
            "generated_itinerary": itinerary,
            "total_budget": budget_total,
            "currency": budget_currency,
            "budget_breakdown": budget_breakdown,
        }

        try:
            data = await self._client.post("rest/v1/trips", payload)
        except Exception:
            return None

        if isinstance(data, list) and data:
            return data[0].get("id")
        if isinstance(data, dict):
            return data.get("id")
        return None

    async def fetch_trips(self, *, user_id: str, limit: int) -> list[TripResponse]:
        if not self._client:
            return []

        params = {
            "owner_id": f"eq.{user_id}",
            "order": "created_at.desc",
            "limit": limit,
        }

        try:
            rows = await self._client.get("rest/v1/trips", params)
        except Exception:
            return []

        if not isinstance(rows, list):
            return []

        trips: list[TripResponse] = []
        for row in rows:
            try:
                trips.append(TripResponse.model_validate(row))
            except ValueError:
                continue
        return trips

    async def fetch_trip_detail(self, *, user_id: str, trip_id: str) -> TripDetailResponse | None:
        row = await self._fetch_trip_row(trip_id, user_id)
        if not row:
            return None

        try:
            trip = TripDetailResponse.model_validate(row)
        except ValueError:
            return None

        expenses = await self.list_expenses(trip_id=trip_id, user_id=user_id)
        total_expenses = sum(expense.amount for expense in expenses)
        remaining_budget = trip.total_budget - total_expenses if trip.total_budget is not None else None

        return trip.model_copy(
            update={
                "total_expenses": total_expenses,
                "remaining_budget": remaining_budget,
                "expenses": expenses,
            }
        )

    async def list_expenses(self, *, trip_id: str, user_id: str) -> list[ExpenseResponse]:
        if not self._client:
            return []

        trip_row = await self._fetch_trip_row(trip_id, user_id)
        if not trip_row:
            return []

        params = {
            "trip_id": f"eq.{trip_id}",
            "order": "occurred_on.desc,created_at.desc",
        }

        try:
            rows = await self._client.get("rest/v1/expenses", params)
        except Exception:
            return []

        if not isinstance(rows, list):
            return []

        expenses: list[ExpenseResponse] = []
        for row in rows:
            try:
                expenses.append(ExpenseResponse.model_validate(row))
            except ValueError:
                continue
        return expenses

    async def add_expense(
        self,
        *,
        trip_id: str,
        user_id: str,
        category: str,
        amount: float,
        currency: str,
        occurred_on: str | None,
    ) -> ExpenseResponse | None:
        if not self._client:
            return None

        trip_row = await self._fetch_trip_row(trip_id, user_id)
        if not trip_row:
            return None

        payload = {
            "trip_id": trip_id,
            "category": category,
            "amount": amount,
            "currency": currency,
            "occurred_on": occurred_on,
        }

        try:
            data = await self._client.post("rest/v1/expenses", payload)
        except Exception:
            return None

        record: dict[str, Any] | None = None
        if isinstance(data, list) and data:
            record = data[0]
        elif isinstance(data, dict):
            record = data

        if not record:
            return None

        try:
            return ExpenseResponse.model_validate(record)
        except ValueError:
            return None

    async def update_expense(
        self,
        *,
        expense_id: str,
        user_id: str,
        updates: dict[str, Any],
    ) -> ExpenseResponse | None:
        if not self._client:
            return None

        record = await self._fetch_expense_row(expense_id)
        trip = record.get("trip") if record else None
        if not record or not trip or trip.get("owner_id") != user_id:
            return None

        if isinstance(record, dict):
            record.pop("trip", None)

        if not updates:
            try:
                return ExpenseResponse.model_validate(record)
            except ValueError:
                return None

        try:
            data = await self._client.patch(f"rest/v1/expenses?id=eq.{expense_id}", updates)
        except Exception:
            return None

        updated: dict[str, Any] | None = None
        if isinstance(data, list) and data:
            updated = data[0]
        elif isinstance(data, dict):
            updated = data

        if not updated:
            return None

        if isinstance(updated, dict):
            updated.pop("trip", None)

        try:
            return ExpenseResponse.model_validate(updated)
        except ValueError:
            return None

    async def delete_expense(
        self,
        *,
        expense_id: str,
        user_id: str,
    ) -> bool:
        if not self._client:
            return False

        record = await self._fetch_expense_row(expense_id)
        trip = record.get("trip") if record else None
        if not record or not trip or trip.get("owner_id") != user_id:
            return False

        try:
            await self._client.delete(f"rest/v1/expenses?id=eq.{expense_id}")
        except Exception:
            return False

        return True


def get_trip_repository() -> TripRepository:
    settings = get_settings()
    return TripRepository(
        supabase_url=settings.supabase_url,
        service_role_key=settings.supabase_service_role_key,
    )
