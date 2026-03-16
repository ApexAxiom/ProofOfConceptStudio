import { NextRequest, NextResponse } from "next/server";
import { filterPosts } from "../../../lib/server/posts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function canDebug(request: NextRequest) {
  const adminToken = process.env.ADMIN_TOKEN?.trim();
  const providedToken = request.headers.get("x-admin-token")?.trim();
  return Boolean(adminToken && providedToken && providedToken === adminToken);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const region = searchParams.get("region") ?? "";
  const portfolio = searchParams.get("portfolio") ?? "";
  const limit = searchParams.get("limit") ?? "10";
  const runWindow = searchParams.get("runWindow") ?? "";

  try {
    const posts = await filterPosts({
      region,
      portfolio: portfolio || undefined,
      runWindow: runWindow || undefined,
      limit: limit ? Number(limit) : 10
    });
    return NextResponse.json(posts);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    console.error(
      JSON.stringify({
        level: "error",
        event: "posts_route_failed",
        region,
        portfolio: portfolio || null,
        runWindow: runWindow || null,
        limit,
        error: message
      })
    );
    if (canDebug(request)) {
      return NextResponse.json({ posts: [], error: message }, { status: 500 });
    }
    return NextResponse.json([], { status: 500 });
  }
}
