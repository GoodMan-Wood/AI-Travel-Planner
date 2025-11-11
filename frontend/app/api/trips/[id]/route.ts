import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const tripId = params.id;
  const url = new URL(_request.url);
  const userId = url.searchParams.get("userId");

  if (!tripId || !userId) {
    return NextResponse.json({ message: "tripId and userId are required" }, { status: 400 });
  }

  const response = await fetch(
    `${BACKEND_URL}/api/v1/trips/${encodeURIComponent(tripId)}?userId=${encodeURIComponent(userId)}`,
    {
      headers: {
        "content-type": "application/json"
      },
      cache: "no-store"
    }
  );

  if (!response.ok) {
    return NextResponse.json({ message: "Failed to load trip" }, { status: response.status });
  }

  const payload = await response.json();
  return NextResponse.json(payload);
}
