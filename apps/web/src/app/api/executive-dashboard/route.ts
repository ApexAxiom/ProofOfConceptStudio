import { NextResponse } from "next/server";
import { getExecutiveDashboardData } from "../../../lib/executive-dashboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const payload = await getExecutiveDashboardData();
    return NextResponse.json(payload, {
      status: 200,
      headers: {
        "Cache-Control": "no-store"
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
