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
  unit: string;
  region: "global" | "apac" | "americas";
  lastUpdated: string;
  source: string;
}

// Market data with READABLE NAMES for category managers
const COMMODITIES: Array<{
  symbol: string;
  yahooSymbol: string;
  name: string;
  unit: string;
  region: "global" | "apac" | "americas";
  fallbackPrice: number;
}> = [
  // GLOBAL - Affects all regions
  { symbol: "WTI", yahooSymbol: "CL=F", name: "WTI Crude Oil", unit: "/barrel", region: "global", fallbackPrice: 71.23 },
  { symbol: "BRENT", yahooSymbol: "BZ=F", name: "Brent Crude Oil", unit: "/barrel", region: "global", fallbackPrice: 74.89 },
  { symbol: "GOLD", yahooSymbol: "GC=F", name: "Gold", unit: "/oz", region: "global", fallbackPrice: 2045.50 },
  { symbol: "COPPER", yahooSymbol: "HG=F", name: "Copper", unit: "/lb", region: "global", fallbackPrice: 3.85 },
  
  // AMERICAS / INTERNATIONAL - Houston focus
  { symbol: "NATGAS-US", yahooSymbol: "NG=F", name: "US Natural Gas (Henry Hub)", unit: "/MMBtu", region: "americas", fallbackPrice: 3.12 },
  { symbol: "HRC-STEEL", yahooSymbol: "HRC1!", name: "US HRC Steel", unit: "/ton", region: "americas", fallbackPrice: 742.50 },
  { symbol: "LNG-US", yahooSymbol: "LNG", name: "US LNG Export Price", unit: "/MMBtu", region: "americas", fallbackPrice: 8.45 },
  
  // APAC - Perth/Australia focus
  { symbol: "AUD-USD", yahooSymbol: "AUDUSD=X", name: "Australian Dollar", unit: "", region: "apac", fallbackPrice: 0.6534 },
  { symbol: "LNG-ASIA", yahooSymbol: "LNG-ASIA", name: "LNG Asia Spot (JKM)", unit: "/MMBtu", region: "apac", fallbackPrice: 12.45 },
  { symbol: "IRON-ORE", yahooSymbol: "TIO=F", name: "Iron Ore (SGX)", unit: "/tonne", region: "apac", fallbackPrice: 108.50 },
  
  // Freight/Logistics - Global
  { symbol: "BDI", yahooSymbol: "^BDI", name: "Baltic Dry Index", unit: "pts", region: "global", fallbackPrice: 1245 },
];

// Try to fetch real data from Yahoo Finance
async function fetchYahooFinanceQuotes(symbols: string[]): Promise<Map<string, any>> {
  const results = new Map<string, any>();
  
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
      console.error(`Yahoo Finance API returned ${response.status}`);
      return results;
    }

    const data = await response.json();
    const quotes = data?.quoteResponse?.result || [];

    for (const q of quotes) {
      results.set(q.symbol, {
        price: q.regularMarketPrice || 0,
        change: q.regularMarketChange || 0,
        changePercent: q.regularMarketChangePercent || 0,
        lastUpdated: q.regularMarketTime ? new Date(q.regularMarketTime * 1000).toISOString() : new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error("Yahoo Finance fetch error:", error);
  }
  
  return results;
}

// Generate realistic price variations for demo/fallback
function generateRealisticVariation(basePrice: number, volatility: number = 0.02): { price: number; change: number; changePercent: number } {
  const changePercent = (Math.random() - 0.5) * volatility * 100;
  const change = basePrice * (changePercent / 100);
  const price = basePrice + change;
  return { price, change, changePercent };
}

export async function GET() {
  try {
    const now = new Date().toISOString();
    
    // Get Yahoo symbols for fetching
    const yahooSymbols = COMMODITIES
      .map(c => c.yahooSymbol)
      .filter(s => !s.includes("-") && s !== "HRC1!"); // Filter out synthetic symbols
    
    // Try to fetch real data
    const yahooData = await fetchYahooFinanceQuotes(yahooSymbols);
    const hasLiveData = yahooData.size > 0;
    
    // Build response with readable names
    const data: CommodityPrice[] = COMMODITIES.map(commodity => {
      const liveData = yahooData.get(commodity.yahooSymbol);
      
      if (liveData && liveData.price > 0) {
        return {
          symbol: commodity.symbol,
          name: commodity.name,
          price: liveData.price,
          change: liveData.change,
          changePercent: liveData.changePercent,
          currency: "USD",
          unit: commodity.unit,
          region: commodity.region,
          lastUpdated: liveData.lastUpdated,
          source: "yahoo",
        };
      }
      
      // Fallback with realistic variations
      const variation = generateRealisticVariation(commodity.fallbackPrice);
      return {
        symbol: commodity.symbol,
        name: commodity.name,
        price: variation.price,
        change: variation.change,
        changePercent: variation.changePercent,
        currency: "USD",
        unit: commodity.unit,
        region: commodity.region,
        lastUpdated: now,
        source: "estimate",
      };
    });

    return NextResponse.json({
      success: true,
      data,
      timestamp: now,
      source: hasLiveData ? "live" : "estimate",
    });
  } catch (error) {
    console.error("Market data fetch error:", error);
    
    // Return fallback data with readable names
    const now = new Date().toISOString();
    const fallbackData: CommodityPrice[] = COMMODITIES.map(commodity => {
      const variation = generateRealisticVariation(commodity.fallbackPrice);
      return {
        symbol: commodity.symbol,
        name: commodity.name,
        price: variation.price,
        change: variation.change,
        changePercent: variation.changePercent,
        currency: "USD",
        unit: commodity.unit,
        region: commodity.region,
        lastUpdated: now,
        source: "fallback",
      };
    });
    
    return NextResponse.json({
      success: true,
      data: fallbackData,
      timestamp: now,
      source: "fallback",
    });
  }
}
