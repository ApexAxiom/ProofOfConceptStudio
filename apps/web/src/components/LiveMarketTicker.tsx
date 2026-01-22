"use client";

import { useEffect, useState, useRef } from "react";
import { formatTimestampWithTimezones } from "@/lib/format-time";

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

function TickerItem({ commodity }: { commodity: CommodityPrice }) {
  const isPositive = commodity.change >= 0;
  const changeText = `${isPositive ? "+" : ""}${commodity.changePercent.toFixed(2)}%`;
  
  return (
    <a
      href={getSourceUrl(commodity.symbol)}
      target="_blank"
      rel="noopener noreferrer"
      className="ticker-item group flex items-center gap-4 whitespace-nowrap"
    >
      {/* Symbol */}
      <span className="font-mono text-xs font-semibold text-muted-foreground group-hover:text-foreground transition-colors tracking-wider">
        {commodity.symbol}
      </span>
      
      {/* Price */}
      <span className="font-mono text-sm font-semibold text-foreground">
        ${formatPrice(commodity.price)}
      </span>
      
      {/* Change */}
      <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded-md transition-transform group-hover:scale-105 ${
        isPositive 
          ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20" 
          : "text-red-400 bg-red-500/10 border border-red-500/20"
      }`}>
        <span className="mr-1">{isPositive ? "▲" : "▼"}</span>
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
  const [isPaused, setIsPaused] = useState(false);
  const tickerRef = useRef<HTMLDivElement>(null);
  const isLive = source === "live" || source === "yahoo";

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
    // Refresh hourly instead of every 15 minutes
    const interval = setInterval(fetchData, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="ticker-container py-4">
        <div className="flex items-center gap-8 px-6">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-4 w-16 animate-pulse rounded bg-muted/50" />
              <div className="h-4 w-20 animate-pulse rounded bg-muted/50" />
              <div className="h-5 w-16 animate-pulse rounded-md bg-muted/50" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {showHeader && (
        <div className="flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            {/* Premium header styling */}
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <h3 className="font-display text-sm font-semibold text-foreground">Market Indices</h3>
            </div>
            
            <span className={`flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.15em] px-2 py-1 rounded-full ${
              isLive
                ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20"
                : "text-amber-400 bg-amber-500/10 border border-amber-500/20"
            }`}>
              <span className={`live-pulse h-1.5 w-1.5 rounded-full ${isLive ? "bg-emerald-500" : "bg-amber-500"}`} />
              {isLive ? "Live" : "Estimated (Synthetic)"}
            </span>
          </div>
          
          {lastUpdated && (
            <span className="text-[10px] font-mono text-muted-foreground">
              Last update: {formatTimestampWithTimezones(lastUpdated)}
            </span>
          )}
        </div>
      )}
      
      {/* Scrolling Ticker - Premium styling */}
      <div 
        className="ticker-container"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <div 
          ref={tickerRef}
          className={`ticker-track ${isPaused ? 'paused' : ''}`}
        >
          {/* First set of items */}
          <div className="ticker-content">
            {data.map((commodity) => (
              <TickerItem key={`a-${commodity.symbol}`} commodity={commodity} />
            ))}
          </div>
          {/* Duplicate for seamless loop */}
          <div className="ticker-content">
            {data.map((commodity) => (
              <TickerItem key={`b-${commodity.symbol}`} commodity={commodity} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
