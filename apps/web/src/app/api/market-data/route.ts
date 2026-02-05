import { NextRequest, NextResponse } from "next/server";
import { getMarketSnapshot, getPortfolioMarketQuotes } from "../../../lib/market-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 3_600; // refresh hourly

export async function GET(request: NextRequest) {
  try {
    const portfolio = request.nextUrl.searchParams.get("portfolio");

    if (portfolio) {
      const snapshot = await getPortfolioMarketQuotes(portfolio);
      return NextResponse.json({
        success: true,
        data: snapshot.quotes,
        timestamp: snapshot.generatedAt,
        source: snapshot.source
      });
    }

    const snapshot = await getMarketSnapshot();
    return NextResponse.json({
      success: true,
      data: snapshot.quotes,
      timestamp: snapshot.generatedAt,
      source: snapshot.source
    });
  } catch (error) {
    console.error("Market data endpoint failed", error);
    return NextResponse.json(
      {
        success: false,
        data: [],
        error: "market_data_unavailable"
      },
      { status: 500 }
    );
  }
}

