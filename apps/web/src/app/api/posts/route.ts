import { NextRequest, NextResponse } from "next/server";
import { getApiBaseUrl } from "../../../lib/api-base";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const region = searchParams.get("region") ?? "";
  const portfolio = searchParams.get("portfolio") ?? "";
  const limit = searchParams.get("limit") ?? "10";

  try {
    const apiBaseUrl = await getApiBaseUrl();
    const query = new URLSearchParams();
    if (region) query.set("region", region);
    if (portfolio) query.set("portfolio", portfolio);
    if (limit) query.set("limit", limit);

    const res = await fetch(`${apiBaseUrl}/posts?${query.toString()}`, {
      cache: "no-store"
    });

    if (!res.ok) {
      return NextResponse.json([], { status: res.status });
    }

    const posts = await res.json();
    return NextResponse.json(posts);
  } catch {
    return NextResponse.json([], { status: 500 });
  }
}
