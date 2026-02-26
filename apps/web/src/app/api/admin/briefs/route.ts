import { NextResponse } from "next/server";
import { getApiBaseUrl } from "../../../../lib/api-base";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const region = typeof body.region === "string" && body.region.trim() ? body.region.trim() : "us-mx-la-lng";
  const portfolio = typeof body.portfolio === "string" ? body.portfolio.trim() : "";
  const runWindow = body.runWindow === "apac" || body.runWindow === "international" ? body.runWindow : "";
  const limitRaw = Number(body.limit ?? 200);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.floor(limitRaw) : 200;

  const query = new URLSearchParams({ region, limit: String(limit) });
  if (portfolio) query.set("portfolio", portfolio);
  if (runWindow) query.set("runWindow", runWindow);

  const base = await getApiBaseUrl();
  const res = await fetch(`${base}/admin/briefs?${query.toString()}`, {
    method: "GET",
    headers: {
      "x-admin-token": body.adminToken ?? ""
    }
  });

  const json = await res.json();
  return NextResponse.json(json, { status: res.status });
}
