import { NextResponse } from "next/server";
import { getApiBaseUrl } from "../../../lib/api-base";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Proxies the agent catalog through the web app so client components stay server-only.
 */
export async function GET() {
  try {
    const base = await getApiBaseUrl();
    const res = await fetch(`${base}/agents`);
    const json = await res.json();
    return NextResponse.json(json, { status: res.status });
  } catch (err) {
    return NextResponse.json({ agents: [], error: "unavailable" }, { status: 503 });
  }
}
