"use client";

import { useEffect, useState } from "react";

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

interface MarketDataResponse {
  success: boolean;
  data: CommodityPrice[];
  timestamp: string;
  source: string;
}

function formatPrice(price: number): string {
  if (price >= 1000) {
    return price.toLocaleString("en-US", { maximumFractionDigits: 0 });
  }
  if (price < 1) {
    return price.toFixed(4);
  }
  return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getSourceUrl(symbol: string): string {
  const symbolMap: Record<string, string> = {
    "WTI": "CL=F",
    "BRENT": "BZ=F",
    "GOLD": "GC=F",
    "COPPER": "HG=F",
    "NATGAS-US": "NG=F",
    "HRC-STEEL": "HRC1!",
    "LNG-US": "LNG",
    "AUD-USD": "AUDUSD=X",
    "LNG-ASIA": "LNG-ASIA",
    "IRON-ORE": "TIO=F",
    "BDI": "^BDI"
  };
  const yahooSymbol = symbolMap[symbol] || symbol;
  return `https://finance.yahoo.com/quote/${yahooSymbol}`;
}

function CompactTicker({ commodity }: { commodity: CommodityPrice }) {
  const isPositive = commodity.change >= 0;
  const changeText = `${isPositive ? "+" : ""}${commodity.changePercent.toFixed(2)}%`;
  
  return (
    <a
      href={getSourceUrl(commodity.symbol)}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-card hover:bg-muted/50 transition-colors text-sm"
    >
      <span className="font-medium text-foreground whitespace-nowrap">{commodity.symbol}</span>
      <span className="text-foreground font-semibold">
        ${formatPrice(commodity.price)}
      </span>
      <span className={`text-xs font-medium ${isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
        {changeText}
      </span>
    </a>
  );
}

export function LiveMarketTicker({ showHeader = true }: { showHeader?: boolean }) {
  const [data, setData] = useState<CommodityPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [source, setSource] = useState<string>("");

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/market-data");
        const json: MarketDataResponse = await res.json();
        if (json.success && json.data) {
          setData(json.data);
          setLastUpdated(json.timestamp);
          setSource(json.source);
        }
      } catch (error) {
        console.error("Failed to fetch market data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
    const interval = setInterval(fetchData, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex flex-wrap gap-2">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-8 w-32 animate-pulse rounded-md bg-muted" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {showHeader && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">Market Indices</h3>
            {(source === "live" || source === "yahoo") && (
              <span className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                LIVE
              </span>
            )}
          </div>
          {lastUpdated && (
            <span className="text-xs text-muted-foreground">
              {new Date(lastUpdated).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {data.map((commodity) => (
          <CompactTicker key={commodity.symbol} commodity={commodity} />
        ))}
      </div>
    </div>
  );
}
