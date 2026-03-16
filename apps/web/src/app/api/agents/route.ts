import { NextResponse } from "next/server";
import { listAgentSummaries } from "@proof/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Exposes the shared agent catalog directly so the web tier does not need a live API/runner dependency for agent metadata.
 */
export async function GET() {
  try {
    return NextResponse.json({
      agents: listAgentSummaries({ includeFeeds: true })
    });
  } catch (err) {
    return NextResponse.json({ agents: [], error: "unavailable" }, { status: 503 });
  }
}
