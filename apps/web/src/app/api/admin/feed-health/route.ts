import { NextResponse } from "next/server";
import { getAdminToken } from "@proof/shared";
import { initializeSecrets } from "../../../../lib/secrets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  await initializeSecrets();
  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const adminToken = typeof body.adminToken === "string" ? body.adminToken.trim() : "";
  if (!adminToken || adminToken !== getAdminToken()) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  return NextResponse.json(
    { error: "feed health is not wired to the Lambda runner yet" },
    { status: 501 }
  );
}
