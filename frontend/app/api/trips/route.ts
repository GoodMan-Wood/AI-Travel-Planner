import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const limit = searchParams.get("limit") ?? "20";

  if (!userId) {
    return NextResponse.json({ message: "userId is required" }, { status: 400 });
  }

  const response = await fetch(
    `${BACKEND_URL}/api/v1/trips?userId=${encodeURIComponent(userId)}&limit=${encodeURIComponent(limit)}`,
    {
      headers: {
        "content-type": "application/json"
      },
      cache: "no-store"
    }
  );

  if (!response.ok) {
    return NextResponse.json({ message: "Failed to load trips" }, { status: response.status });
  }

  const payload = await response.json();
  return NextResponse.json(payload);
}
