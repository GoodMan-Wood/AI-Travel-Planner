import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

export async function POST(request: Request) {
  const body = await request.json();
  const { content } = body ?? {};

  if (!content || typeof content !== "string") {
    return NextResponse.json({ message: "content is required" }, { status: 400 });
  }

  const response = await fetch(`${BACKEND_URL}/api/v1/expenses/parse`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    return NextResponse.json({ message: "Failed to parse expense" }, { status: response.status });
  }

  const payload = await response.json();
  return NextResponse.json(payload);
}
