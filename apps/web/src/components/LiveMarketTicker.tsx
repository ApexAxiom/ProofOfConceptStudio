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

function getRegionBadge(region: string): { label: string; color: string } {
  switch (region) {
    case "apac":
      return { label: "APAC", color: "bg-cyan-500/20 text-cyan-400" };
    case "americas":
      return { label: "INTL", color: "bg-violet-500/20 text-violet-400" };
    default:
      return { label: "GLOBAL", color: "bg-emerald-500/20 text-emerald-400" };
  }
}

function CommodityCard({ commodity }: { commodity: CommodityPrice }) {
  const { text, isPositive } = formatChange(commodity.change, commodity.changePercent);
  const regionBadge = getRegionBadge(commodity.region);
  
  return (
    <div className="flex min-w-[220px] flex-col gap-2 rounded-xl border border-slate-700/50 bg-slate-800/50 p-4 backdrop-blur-sm transition-all hover:border-slate-600/50 hover:bg-slate-800/70">
      <div className="flex items-center justify-between gap-2">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${regionBadge.color}`}>
          {regionBadge.label}
        </span>
        {commodity.source === "live" || commodity.source === "yahoo" ? (
          <span className="flex items-center gap-1 text-[10px] text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            LIVE
          </span>
        ) : (
          <span className="text-[10px] text-slate-500">Delayed</span>
        )}
      </div>
      
      {/* Commodity Name - PROMINENT */}
      <div className="text-sm font-semibold text-white">
        {commodity.name}
      </div>
      
      {/* Price */}
      <div className="flex items-baseline gap-1">
        <span className="text-xl font-bold text-white">
          {commodity.currency === "USD" && "$"}
          {formatPrice(commodity.price)}
        </span>
        <span className="text-xs text-slate-400">
          {commodity.unit}
        </span>
      </div>
      
      {/* Change */}
      <div className={`text-sm font-medium ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
        {text}
      </div>
    </div>
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
    // Refresh every 5 minutes
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-700/50 bg-slate-900/50 p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="h-10 w-10 animate-pulse rounded-xl bg-slate-700" />
          <div className="space-y-2">
            <div className="h-4 w-32 animate-pulse rounded bg-slate-700" />
            <div className="h-3 w-48 animate-pulse rounded bg-slate-700" />
          </div>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-32 w-56 animate-pulse rounded-xl bg-slate-800" />
          ))}
        </div>
      </div>
    );
  }

  // Group by region
  const globalData = data.filter(d => d.region === "global");
  const apacData = data.filter(d => d.region === "apac");
  const americasData = data.filter(d => d.region === "americas");

  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-900/50 p-6">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 text-amber-400">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Market Pulse</h3>
            <p className="text-sm text-slate-400">Key benchmarks for category managers</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          {source === "live" || source === "yahoo" ? (
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              Live Data
            </span>
          ) : (
            <span className="flex items-center gap-1.5 rounded-full bg-slate-700/50 px-2.5 py-1 text-slate-400">
              <span className="h-2 w-2 rounded-full bg-slate-400" />
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

      {/* All commodities in a scrollable row */}
      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin">
        {data.map((commodity) => (
          <CommodityCard key={commodity.symbol} commodity={commodity} />
        ))}
      </div>
      
      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500/50" />
          <span className="text-emerald-400/70">GLOBAL</span> = All regions
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-cyan-500/50" />
          <span className="text-cyan-400/70">APAC</span> = Australia/Perth focus
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-violet-500/50" />
          <span className="text-violet-400/70">INTL</span> = Americas/Houston focus
        </span>
      </div>
    </div>
  );
}
