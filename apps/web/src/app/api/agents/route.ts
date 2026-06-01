import { NextResponse } from "next/server";
import { listAgentSummaries } from "@proof/shared";
import { getChatAccessState } from "../../../lib/server/chat-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Exposes the shared agent catalog directly so the web tier does not need a live API/runner dependency for agent metadata.
 */
export async function GET() {
  const auth = await getChatAccessState();
  if (!auth.authenticated) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  try {
    return NextResponse.json(
      {
        agents: listAgentSummaries({ includeFeeds: true })
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900"
        }
      }
    );
  } catch (err) {
    return NextResponse.json({ agents: [], error: "unavailable" }, { status: 503 });
  }
}
