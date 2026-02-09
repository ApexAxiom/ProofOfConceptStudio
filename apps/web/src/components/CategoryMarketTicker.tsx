"use client";

import { useEffect, useState } from "react";
import { CategoryGroup, CATEGORY_INDICES } from "@proof/shared";
import { formatTimestampWithTimezones } from "@/lib/format-time";

interface PriceData {
  symbol: string;
  yahooSymbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  unit: string;
  sourceUrl: string;
  state: "live" | "stale" | "fallback";
}

interface MarketDataResponse {
  success: boolean;
  data: Array<{
    symbol: string;
    yahooSymbol: string;
    name: string;
    price: number;
    change: number;
    changePercent: number;
    unit: string;
    sourceUrl: string;
    state: "live" | "stale" | "fallback";
  }>;
  timestamp: string;
  source: "live" | "mixed" | "fallback";
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

function TickerItem({ data }: { data: PriceData }) {
  const isPositive = data.change >= 0;
  const changeText = `${isPositive ? "+" : ""}${data.changePercent.toFixed(2)}%`;
  
  return (
    <a
      href={data.sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="ticker-item group flex items-center gap-3 px-4 py-2 whitespace-nowrap"
    >
      <span className="font-semibold text-foreground tracking-tight">{data.symbol}</span>
      <span className="text-foreground/90 font-mono text-sm">
        {data.unit.startsWith("/") ? "" : "$"}
        {formatPrice(data.price)}
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

export function CategoryMarketTicker({ category }: { category: CategoryGroup }) {
  const [data, setData] = useState<PriceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    async function fetchData() {
      const indices = CATEGORY_INDICES[category] ?? [];
      
      try {
        const response = await fetch("/api/market-data");
        const json = (await response.json()) as MarketDataResponse;
        const liveQuotes = json.success && Array.isArray(json.data) ? json.data : [];
        const byYahooSymbol = new Map(liveQuotes.map((quote) => [quote.yahooSymbol, quote]));
        const bySymbol = new Map(liveQuotes.map((quote) => [quote.symbol, quote]));

        const priceData: PriceData[] = indices
          .map((idx) => byYahooSymbol.get(idx.yahooSymbol) ?? bySymbol.get(idx.symbol) ?? null)
          .filter((quote): quote is NonNullable<typeof quote> => Boolean(quote))
          .map((quote) => ({
            symbol: quote.symbol,
            yahooSymbol: quote.yahooSymbol,
            name: quote.name,
            price: quote.price,
            change: quote.change,
            changePercent: quote.changePercent,
            unit: quote.unit,
            sourceUrl: quote.sourceUrl,
            state: quote.state
          }));

        setData(priceData);
        setLastUpdated(json.timestamp ?? "");
      } catch (error) {
        console.error("Failed to fetch category market data:", error);
        setData([]);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
    // Refresh hourly instead of every 15 minutes
    const interval = setInterval(fetchData, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [category]);

  if (loading) {
    return (
      <div className="ticker-container">
        <div className="flex items-center gap-6 px-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-6 w-28 animate-pulse rounded bg-muted/50" />
          ))}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">Category market data is currently unavailable.</p>;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <svg className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            <h3 className="text-sm font-semibold text-foreground">Category Indices</h3>
          </div>
          <span className="flex items-center gap-1.5 text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
            <span className="live-pulse h-1.5 w-1.5 rounded-full bg-emerald-500" />
            HOURLY
          </span>
        </div>
        {lastUpdated && (
          <span className="text-xs text-muted-foreground font-mono">
            Last update: {formatTimestampWithTimezones(lastUpdated)}
          </span>
        )}
      </div>
      
      {/* Scrolling Ticker */}
      <div 
        className="ticker-container"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <div className={`ticker-track ${isPaused ? 'paused' : ''}`}>
          {/* First set of items */}
          <div className="ticker-content">
            {data.map((item) => (
              <TickerItem key={`a-${item.symbol}`} data={item} />
            ))}
          </div>
          {/* Duplicate for seamless loop */}
          <div className="ticker-content">
            {data.map((item) => (
              <TickerItem key={`b-${item.symbol}`} data={item} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
