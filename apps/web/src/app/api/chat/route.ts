import { NextResponse } from "next/server";
import { getApiBaseUrl } from "../../../lib/api-base";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const CHAT_PROXY_TIMEOUT_MS = Number(process.env.CHAT_PROXY_TIMEOUT_MS ?? 45000);

export async function GET() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const base = await getApiBaseUrl();
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
  const timeout = setTimeout(() => controller.abort(), CHAT_PROXY_TIMEOUT_MS);
  try {
    const body = await request.json();
    const base = await getApiBaseUrl();
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
