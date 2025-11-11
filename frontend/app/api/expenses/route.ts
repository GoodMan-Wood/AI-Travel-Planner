import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const tripId = searchParams.get("tripId");

  if (!userId || !tripId) {
    return NextResponse.json({ message: "userId and tripId are required" }, { status: 400 });
  }

  const response = await fetch(
    `${BACKEND_URL}/api/v1/expenses?userId=${encodeURIComponent(userId)}&tripId=${encodeURIComponent(tripId)}`,
    { cache: "no-store" }
  );

  if (!response.ok) {
    return NextResponse.json({ message: "Failed to load expenses" }, { status: response.status });
  }

  const payload = await response.json();
  return NextResponse.json(payload);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { userId, ...payload } = body ?? {};

  if (!userId || !payload?.tripId) {
    return NextResponse.json({ message: "userId and tripId are required" }, { status: 400 });
  }

  const response = await fetch(
    `${BACKEND_URL}/api/v1/expenses?userId=${encodeURIComponent(userId)}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    }
  );

  if (!response.ok) {
    return NextResponse.json({ message: "Failed to create expense" }, { status: response.status });
  }

  const payloadResponse = await response.json();
  return NextResponse.json(payloadResponse, { status: 201 });
}

export async function PATCH(request: Request) {
  const body = await request.json();
  const { userId, expenseId, ...updates } = body ?? {};

  if (!userId || !expenseId) {
    return NextResponse.json({ message: "userId and expenseId are required" }, { status: 400 });
  }

  const response = await fetch(
    `${BACKEND_URL}/api/v1/expenses/${encodeURIComponent(expenseId)}?userId=${encodeURIComponent(userId)}`,
    {
      method: "PATCH",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(updates)
    }
  );

  if (!response.ok) {
    return NextResponse.json({ message: "Failed to update expense" }, { status: response.status });
  }

  const payloadResponse = await response.json();
  return NextResponse.json(payloadResponse);
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const expenseId = searchParams.get("expenseId");

  if (!userId || !expenseId) {
    return NextResponse.json({ message: "userId and expenseId are required" }, { status: 400 });
  }

  const response = await fetch(
    `${BACKEND_URL}/api/v1/expenses/${encodeURIComponent(expenseId)}?userId=${encodeURIComponent(userId)}`,
    { method: "DELETE" }
  );

  if (!response.ok && response.status !== 204) {
    return NextResponse.json({ message: "Failed to delete expense" }, { status: response.status });
  }

  return new NextResponse(null, { status: 204 });
}
