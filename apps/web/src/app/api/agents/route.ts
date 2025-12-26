import { NextResponse } from "next/server";

/**
 * Proxies the agent catalog through the web app so client components stay server-only.
 */
export async function GET() {
  try {
    const base = process.env.API_BASE_URL ?? "http://localhost:3001";
    const res = await fetch(`${base}/agents`);
    const json = await res.json();
    return NextResponse.json(json, { status: res.status });
  } catch (err) {
    return NextResponse.json({ agents: [], error: "unavailable" }, { status: 503 });
  }
}
