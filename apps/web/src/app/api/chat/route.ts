import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json();
  const base = process.env.API_BASE_URL ?? "http://localhost:3001";
  const res = await fetch(`${base}/chat`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const json = await res.json();
  return NextResponse.json(json, { status: res.status });
}
