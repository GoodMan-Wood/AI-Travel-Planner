import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

export async function POST(request: Request) {
  const body = await request.json();

  const response = await fetch(`${BACKEND_URL}/api/v1/itineraries`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    return NextResponse.json(
      {
        message: "Failed to generate itinerary"
      },
      {
        status: response.status
      }
    );
  }

  const payload = await response.json();
  return NextResponse.json(payload);
}
