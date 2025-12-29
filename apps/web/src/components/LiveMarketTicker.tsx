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

function formatPrice(price: number, decimals: number = 2): string {
  if (price >= 1000) {
    return price.toLocaleString("en-US", { maximumFractionDigits: 0 });
  }
  if (price < 1) {
    return price.toFixed(4);
  }
  return price.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function formatChange(change: number, percent: number): { text: string; isPositive: boolean } {
  const sign = change >= 0 ? "+" : "";
  const text = `${sign}${change.toFixed(2)} (${sign}${percent.toFixed(2)}%)`;
  return { text, isPositive: change >= 0 };
}

function getRegionBadge(region: string): { label: string; className: string } {
  switch (region) {
    case "apac":
      return { label: "APAC", className: "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-400" };
    case "americas":
      return { label: "INTL", className: "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-400" };
    default:
      return { label: "GLOBAL", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400" };
  }
}

function CommodityCard({ commodity }: { commodity: CommodityPrice }) {
  const { text, isPositive } = formatChange(commodity.change, commodity.changePercent);
  const regionBadge = getRegionBadge(commodity.region);
  
  // Get Yahoo Finance URL for the commodity
  const getSourceUrl = () => {
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
    const yahooSymbol = symbolMap[commodity.symbol] || commodity.symbol;
    return `https://finance.yahoo.com/quote/${yahooSymbol}`;
  };
  
  return (
    <a
      href={getSourceUrl()}
      target="_blank"
      rel="noopener noreferrer"
      className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 transition-all hover:shadow-sm hover:border-primary/40 cursor-pointer"
    >
      <div className="flex items-center justify-between gap-2">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${regionBadge.className}`}>
          {regionBadge.label}
        </span>
        {commodity.source === "live" || commodity.source === "yahoo" ? (
          <span className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            LIVE
          </span>
        ) : (
          <span className="text-[10px] text-muted-foreground">Delayed</span>
        )}
      </div>
      
      <div className="text-sm font-medium text-foreground">
        {commodity.name}
      </div>
      
      <div className="flex items-baseline gap-1">
        <span className="text-lg font-bold text-foreground">
          {commodity.currency === "USD" && "$"}
          {formatPrice(commodity.price)}
        </span>
        <span className="text-xs text-muted-foreground">
          {commodity.unit}
        </span>
      </div>
      
      <div className={`text-sm font-medium ${isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
        {text}
      </div>
    </a>
  );
}

export function LiveMarketTicker() {
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
    const interval = setInterval(fetchData, 15 * 60 * 1000); // Update every 15 minutes
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="h-10 w-10 animate-pulse rounded-lg bg-muted" />
          <div className="space-y-2">
            <div className="h-4 w-32 animate-pulse rounded bg-muted" />
            <div className="h-3 w-48 animate-pulse rounded bg-muted" />
          </div>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-28 w-48 flex-shrink-0 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Market Pulse</h3>
            <p className="text-sm text-muted-foreground">Key benchmarks for category managers</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {source === "live" || source === "yahoo" ? (
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Data
            </span>
          ) : (
            <span className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-muted-foreground/50" />
              Market Estimates
            </span>
          )}
          {lastUpdated && (
            <span>
              Updated {new Date(lastUpdated).toLocaleTimeString("en-US", { 
                hour: "2-digit", 
                minute: "2-digit" 
              })}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {data.map((commodity) => (
          <CommodityCard key={commodity.symbol} commodity={commodity} />
        ))}
      </div>
      
      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500/50" />
          <span className="text-emerald-600 dark:text-emerald-400">GLOBAL</span> = All regions
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-cyan-500/50" />
          <span className="text-cyan-600 dark:text-cyan-400">APAC</span> = Australia/Perth focus
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-violet-500/50" />
          <span className="text-violet-600 dark:text-violet-400">INTL</span> = Americas/Houston focus
        </span>
      </div>
    </div>
  );
}
