import { NextResponse } from "next/server";
import { answerChat, ChatRouteError, getChatStatus } from "../../../lib/server/chat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function canDebug(request: Request) {
  const adminToken = process.env.ADMIN_TOKEN?.trim();
  const providedToken = request.headers.get("x-admin-token")?.trim();
  return Boolean(adminToken && providedToken && providedToken === adminToken);
}

export async function GET(request: Request) {
  try {
    const status = await getChatStatus();
    return NextResponse.json(status, {
      headers: { "Cache-Control": "no-store" }
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    console.error(
      JSON.stringify({
        level: "error",
        event: "chat_status_failed",
        error: message
      })
    );
    if (canDebug(request)) {
      return NextResponse.json(
        { enabled: false, model: null, runnerConfigured: false, error: message },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { enabled: false, model: null, runnerConfigured: false, error: "unavailable" },
      { status: 503 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const response = await answerChat({
      ...body,
      clientIp: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined
    });
    return NextResponse.json(response);
  } catch (err) {
    if (err instanceof ChatRouteError) {
      return NextResponse.json(err.payload, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "unknown_error";
    console.error(
      JSON.stringify({
        level: "error",
        event: "chat_request_failed",
        error: message
      })
    );
    if (canDebug(request)) {
      return NextResponse.json(
        { answer: "AI service is unavailable. Please try again once configuration is complete.", error: message },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { answer: "AI service is unavailable. Please try again once configuration is complete." },
      { status: 503 }
    );
  }
}
