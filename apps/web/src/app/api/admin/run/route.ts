import { NextResponse } from "next/server";
import { getApiBaseUrl } from "../../../../lib/api-base";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json();
  const base = await getApiBaseUrl();
  const res = await fetch(`${base}/admin/run`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-admin-token": body.adminToken ?? ""
    },
    body: JSON.stringify({
      runWindow: body.runWindow,
      region: body.region,
      regions: body.regions,
      agentId: body.agentId,
      scheduled: body.scheduled,
      force: body.force
    })
  });
  const json = await res.json();
  return NextResponse.json(json, { status: res.status });
}
