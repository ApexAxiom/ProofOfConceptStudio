import { NextResponse } from "next/server";
import { REGION_LIST, RunWindow, getAdminToken } from "@proof/shared";
import { filterPosts } from "../../../../lib/server/posts";
import { initializeSecrets } from "../../../../lib/secrets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  await initializeSecrets();
  const body = await request.json().catch(() => ({}));
  const adminToken = typeof body.adminToken === "string" ? body.adminToken.trim() : "";
  if (!adminToken || adminToken !== getAdminToken()) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const region = typeof body.region === "string" && body.region.trim() ? body.region.trim() : "us-mx-la-lng";
  const portfolio = typeof body.portfolio === "string" ? body.portfolio.trim() : "";
  const runWindow = body.runWindow === "apac" || body.runWindow === "international" ? (body.runWindow as RunWindow) : undefined;
  const limitRaw = Number(body.limit ?? 200);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.floor(limitRaw) : 200;
  const validRegions = new Set<string>(REGION_LIST.map((item) => item.slug));

  if (!validRegions.has(region)) {
    return NextResponse.json({ error: "region must be a valid RegionSlug" }, { status: 400 });
  }

  const posts = await filterPosts({
    region,
    portfolio: portfolio || undefined,
    runWindow,
    limit,
    includeHidden: true
  });

  return NextResponse.json({
    region,
    portfolio: portfolio || null,
    runWindow: runWindow ?? null,
    count: posts.length,
    posts
  });
}
