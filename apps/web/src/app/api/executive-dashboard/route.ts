import { NextResponse } from "next/server";
import { getExecutiveDashboardData } from "../../../lib/executive-dashboard";

export const runtime = "nodejs";
export const revalidate = 900;

function cacheSeconds() {
  const value = Number(process.env.EXECUTIVE_DASHBOARD_CACHE_SECONDS ?? 900);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 900;
}

export async function GET() {
  try {
    const payload = await getExecutiveDashboardData();
    return NextResponse.json(payload, {
      status: 200,
      headers: {
        "Cache-Control": `public, s-maxage=${cacheSeconds()}, stale-while-revalidate=${cacheSeconds()}`
      }
    });
  } catch (error) {
    console.error("Failed to build executive dashboard", error);
    return NextResponse.json(
      { error: "dashboard_unavailable" },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  }
}
