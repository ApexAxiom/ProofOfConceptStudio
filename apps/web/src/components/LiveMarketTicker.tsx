"use client";

import { useEffect, useState } from "react";

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

interface MarketDataResponse {
  success: boolean;
  data: CommodityPrice[];
  timestamp: string;
  source: string;
}

function formatPrice(price: number, currency: string): string {
  if (currency === "Index") {
    return price.toLocaleString("en-US", { maximumFractionDigits: 0 });
  }
  if (price < 10) {
    return price.toFixed(4);
  }
  return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatChange(change: number, percent: number): { text: string; isPositive: boolean } {
  const sign = change >= 0 ? "+" : "";
  const text = `${sign}${change.toFixed(2)} (${sign}${percent.toFixed(2)}%)`;
  return { text, isPositive: change >= 0 };
}

function CommodityCard({ commodity }: { commodity: CommodityPrice }) {
  const { text, isPositive } = formatChange(commodity.change, commodity.changePercent);
  
  return (
    <div className="flex min-w-[200px] flex-col gap-1 rounded-xl border border-slate-700/50 bg-slate-800/50 p-4 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
          {commodity.symbol}
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
      <div className="text-lg font-bold text-white">
        {commodity.currency === "USD" && "$"}
        {formatPrice(commodity.price, commodity.currency)}
        {commodity.currency !== "USD" && commodity.currency !== "Index" && (
          <span className="ml-1 text-xs font-normal text-slate-400">{commodity.currency}</span>
        )}
      </div>
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
            <div key={i} className="h-24 w-48 animate-pulse rounded-xl bg-slate-800" />
          ))}
        </div>
      </div>
    );
  }

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
            <p className="text-sm text-slate-400">Key commodity & index prices</p>
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
              Delayed
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

      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin">
        {data.map((commodity) => (
          <CommodityCard key={commodity.symbol} commodity={commodity} />
        ))}
      </div>
      
      <p className="mt-4 text-xs text-slate-500">
        Data sourced from public market feeds. Prices may be delayed up to 15 minutes. 
        For real-time data, consult your trading platform.
      </p>
    </div>
  );
}

