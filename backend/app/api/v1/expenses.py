from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Response

from app.schemas.expense import ExpenseCreate, ExpenseResponse, ExpenseUpdate
from app.services.trip_repository import TripRepository, get_trip_repository

router = APIRouter()


@router.get("", response_model=list[ExpenseResponse])
async def list_expenses(
    trip_id: str = Query(..., alias="tripId"),
    user_id: str = Query(..., alias="userId"),
    repository: TripRepository = Depends(get_trip_repository),
) -> list[ExpenseResponse]:
    if not repository.enabled:
        raise HTTPException(status_code=503, detail="Trip storage not configured")

    return await repository.list_expenses(trip_id=trip_id, user_id=user_id)


@router.post("", response_model=ExpenseResponse, status_code=201)
async def create_expense(
    payload: ExpenseCreate,
    user_id: str = Query(..., alias="userId"),
    repository: TripRepository = Depends(get_trip_repository),
) -> ExpenseResponse:
    if not repository.enabled:
        raise HTTPException(status_code=503, detail="Trip storage not configured")

    expense = await repository.add_expense(
        trip_id=payload.trip_id,
        user_id=user_id,
        category=payload.category,
        amount=payload.amount,
        currency=payload.currency,
        occurred_on=(payload.occurred_on.isoformat() if payload.occurred_on else None),
    )

    if not expense:
        raise HTTPException(status_code=404, detail="Trip not found")

    return expense


@router.patch("/{expense_id}", response_model=ExpenseResponse)
async def update_expense(
    expense_id: str,
    payload: ExpenseUpdate,
    user_id: str = Query(..., alias="userId"),
    repository: TripRepository = Depends(get_trip_repository),
) -> ExpenseResponse:
    if not repository.enabled:
        raise HTTPException(status_code=503, detail="Trip storage not configured")

    updates = payload.model_dump(exclude_unset=True)
    if "occurred_on" in updates and updates["occurred_on"] is not None:
        updates["occurred_on"] = updates["occurred_on"].isoformat()

    expense = await repository.update_expense(
        expense_id=expense_id,
        user_id=user_id,
        updates=updates,
    )

    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")

    return expense


@router.delete("/{expense_id}", status_code=204)
async def delete_expense(
    expense_id: str,
    user_id: str = Query(..., alias="userId"),
    repository: TripRepository = Depends(get_trip_repository),
) -> Response:
    if not repository.enabled:
        raise HTTPException(status_code=503, detail="Trip storage not configured")

    deleted = await repository.delete_expense(expense_id=expense_id, user_id=user_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Expense not found")

    return Response(status_code=204)
