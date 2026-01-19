import { NextResponse } from "next/server";

export async function GET() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const base = process.env.API_BASE_URL ?? "http://localhost:3001";
    const res = await fetch(`${base}/chat/status`, {
      cache: "no-store",
      signal: controller.signal
    });
    const json = await res.json();
    return NextResponse.json(json, {
      status: res.status,
      headers: { "Cache-Control": "no-store" }
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      return NextResponse.json(
        { enabled: false, model: null, runnerConfigured: false, error: "timeout" },
        { status: 504 }
      );
    }
    return NextResponse.json(
      { enabled: false, model: null, runnerConfigured: false, error: "unavailable" },
      { status: 503 }
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(request: Request) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const body = await request.json();
    const base = process.env.API_BASE_URL ?? "http://localhost:3001";
    const res = await fetch(`${base}/chat`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    const json = await res.json();
    return NextResponse.json(json, { status: res.status });
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      return NextResponse.json(
        { answer: "AI service timed out. Please try again in a moment." },
        { status: 504 }
      );
    }
    return NextResponse.json(
      { answer: "AI service is unavailable. Please try again once configuration is complete." },
      { status: 503 }
    );
  } finally {
    clearTimeout(timeout);
  }
}
