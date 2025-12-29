"use client";

import { useEffect, useState, useRef } from "react";

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
      className="ticker-item group flex items-center gap-3 px-4 py-2 whitespace-nowrap"
    >
      <span className="font-semibold text-foreground tracking-tight">{commodity.symbol}</span>
      <span className="text-foreground/90 font-mono text-sm">
        ${formatPrice(commodity.price)}
      </span>
      <span className={`ticker-change font-mono text-xs font-semibold px-1.5 py-0.5 rounded ${
        isPositive 
          ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10" 
          : "text-red-600 dark:text-red-400 bg-red-500/10"
      }`}>
        {isPositive ? "▲" : "▼"} {changeText}
      </span>
      <span className="ticker-separator text-border/50">│</span>
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
      <div className="ticker-container">
        <div className="flex items-center gap-6 px-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="h-6 w-28 animate-pulse rounded bg-muted/50" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {showHeader && (
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <svg className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <h3 className="text-sm font-semibold text-foreground">Market Indices</h3>
            </div>
            {(source === "live" || source === "yahoo") && (
              <span className="flex items-center gap-1.5 text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                <span className="live-pulse h-1.5 w-1.5 rounded-full bg-emerald-500" />
                LIVE
              </span>
            )}
          </div>
          {lastUpdated && (
            <span className="text-xs text-muted-foreground font-mono">
              {new Date(lastUpdated).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
      )}
      
      {/* Scrolling Ticker */}
      <div 
        className="ticker-container"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <div className="ticker-fade-left" />
        <div className="ticker-fade-right" />
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
