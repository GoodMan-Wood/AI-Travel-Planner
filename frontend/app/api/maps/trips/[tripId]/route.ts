import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

export async function GET(
  _request: Request,
  { params }: { params: { tripId: string } }
) {
  const { tripId } = params;
  const userId = new URL(_request.url).searchParams.get("userId");

  if (!tripId || !userId) {
    return NextResponse.json({ message: "tripId and userId are required" }, { status: 400 });
  }

  const response = await fetch(
    `${BACKEND_URL}/api/v1/maps/trips/${encodeURIComponent(tripId)}?userId=${encodeURIComponent(userId)}`,
    { cache: "no-store" }
  );

  if (!response.ok) {
    return NextResponse.json({ message: "Failed to load map data" }, { status: response.status });
  }

  const payload = await response.json();
  return NextResponse.json(payload);
}
