import { NextResponse } from "next/server";
import { getApiBaseUrl } from "../../../../lib/api-base";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const limit = Number(body.limit ?? 200);
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 200;
  const base = await getApiBaseUrl();
  const res = await fetch(`${base}/admin/feed-health?limit=${safeLimit}`, {
    method: "GET",
    headers: {
      "x-admin-token": body.adminToken ?? ""
    }
  });
  const json = await res.json();
  return NextResponse.json(json, { status: res.status });
}
