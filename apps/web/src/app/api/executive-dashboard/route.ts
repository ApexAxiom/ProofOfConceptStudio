import { NextResponse } from "next/server";
import { getExecutiveDashboardData } from "../../../lib/executive-dashboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 3_600; // refresh hourly

export async function GET() {
  try {
    const payload = await getExecutiveDashboardData();
    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    console.error("Failed to build executive dashboard", error);
    return NextResponse.json({ error: "dashboard_unavailable" }, { status: 500 });
  }
}
