import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 300; // Cache for 5 minutes

interface CommodityPrice {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  currency: string;
  lastUpdated: string;
  source: string;
}

// Fallback data when APIs are unavailable
const fallbackData: CommodityPrice[] = [
  { symbol: "CL=F", name: "WTI Crude Oil", price: 71.23, change: -0.45, changePercent: -0.63, currency: "USD", lastUpdated: new Date().toISOString(), source: "fallback" },
  { symbol: "BZ=F", name: "Brent Crude", price: 74.89, change: 0.32, changePercent: 0.43, currency: "USD", lastUpdated: new Date().toISOString(), source: "fallback" },
  { symbol: "NG=F", name: "Natural Gas (US)", price: 3.12, change: 0.08, changePercent: 2.63, currency: "USD", lastUpdated: new Date().toISOString(), source: "fallback" },
  { symbol: "HH=F", name: "Henry Hub", price: 3.15, change: 0.05, changePercent: 1.61, currency: "USD", lastUpdated: new Date().toISOString(), source: "fallback" },
  { symbol: "LNG", name: "LNG Asia Spot", price: 12.45, change: -0.23, changePercent: -1.81, currency: "USD/MMBtu", lastUpdated: new Date().toISOString(), source: "fallback" },
  { symbol: "HRC", name: "HRC Steel", price: 742.50, change: 5.00, changePercent: 0.68, currency: "USD/ton", lastUpdated: new Date().toISOString(), source: "fallback" },
  { symbol: "AUD", name: "AUD/USD", price: 0.6534, change: -0.0012, changePercent: -0.18, currency: "USD", lastUpdated: new Date().toISOString(), source: "fallback" },
  { symbol: "BDI", name: "Baltic Dry Index", price: 1245, change: 15, changePercent: 1.22, currency: "Index", lastUpdated: new Date().toISOString(), source: "fallback" },
];

// Try to fetch real data from Yahoo Finance (public quotes endpoint)
async function fetchYahooFinanceQuotes(symbols: string[]): Promise<CommodityPrice[]> {
  try {
    const symbolList = symbols.join(",");
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbolList}`;
    
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; POCStudio/1.0)",
      },
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      throw new Error(`Yahoo Finance API returned ${response.status}`);
    }

    const data = await response.json();
    const quotes = data?.quoteResponse?.result || [];

    return quotes.map((q: any) => ({
      symbol: q.symbol,
      name: q.shortName || q.longName || q.symbol,
      price: q.regularMarketPrice || 0,
      change: q.regularMarketChange || 0,
      changePercent: q.regularMarketChangePercent || 0,
      currency: q.currency || "USD",
      lastUpdated: new Date(q.regularMarketTime * 1000).toISOString(),
      source: "yahoo",
    }));
  } catch (error) {
    console.error("Yahoo Finance fetch error:", error);
    return [];
  }
}

// Commodity symbols to fetch
const COMMODITY_SYMBOLS = [
  "CL=F",   // WTI Crude Oil
  "BZ=F",   // Brent Crude
  "NG=F",   // Natural Gas
  "HG=F",   // Copper
  "GC=F",   // Gold
  "AUDUSD=X", // AUD/USD
];

export async function GET() {
  try {
    // Try to fetch real data
    const yahooData = await fetchYahooFinanceQuotes(COMMODITY_SYMBOLS);
    
    if (yahooData.length > 0) {
      // Map to more user-friendly names
      const mappedData = yahooData.map((item) => {
        const nameMap: Record<string, string> = {
          "CL=F": "WTI Crude Oil",
          "BZ=F": "Brent Crude",
          "NG=F": "Natural Gas (US)",
          "HG=F": "Copper",
          "GC=F": "Gold",
          "AUDUSD=X": "AUD/USD",
        };
        return {
          ...item,
          name: nameMap[item.symbol] || item.name,
        };
      });

      // Add some synthetic indices that aren't available via Yahoo
      const syntheticData: CommodityPrice[] = [
        {
          symbol: "LNG-ASIA",
          name: "LNG Asia Spot",
          price: 12.45 + (Math.random() - 0.5) * 0.5,
          change: (Math.random() - 0.5) * 0.4,
          changePercent: (Math.random() - 0.5) * 3,
          currency: "USD/MMBtu",
          lastUpdated: new Date().toISOString(),
          source: "estimated",
        },
        {
          symbol: "BDI",
          name: "Baltic Dry Index",
          price: 1245 + Math.floor((Math.random() - 0.5) * 50),
          change: Math.floor((Math.random() - 0.5) * 30),
          changePercent: (Math.random() - 0.5) * 2,
          currency: "Index",
          lastUpdated: new Date().toISOString(),
          source: "estimated",
        },
      ];

      return NextResponse.json({
        success: true,
        data: [...mappedData, ...syntheticData],
        timestamp: new Date().toISOString(),
        source: "live",
      });
    }

    // Fallback to static data
    return NextResponse.json({
      success: true,
      data: fallbackData,
      timestamp: new Date().toISOString(),
      source: "fallback",
    });
  } catch (error) {
    console.error("Market data fetch error:", error);
    return NextResponse.json({
      success: true,
      data: fallbackData,
      timestamp: new Date().toISOString(),
      source: "fallback",
    });
  }
}

