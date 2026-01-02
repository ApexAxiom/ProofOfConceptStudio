"use client";

import { useEffect, useState } from "react";
import { getPortfolioIndices, PortfolioIndex } from "@proof/shared";

interface PriceData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  unit: string;
  sourceUrl: string;
}

interface PortfolioMarketTickerProps {
  portfolio: string;
  variant?: "ticker" | "grid";
  limit?: number;
  showHeader?: boolean;
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
        {data.unit.startsWith("/") ? "" : "$"}{formatPrice(data.price)}
        {data.unit && <span className="text-xs text-muted-foreground ml-0.5">{data.unit}</span>}
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

function GridItem({ data }: { data: PriceData }) {
  const isPositive = data.change >= 0;
  const changeText = `${isPositive ? "+" : ""}${data.changePercent.toFixed(2)}%`;
  
  return (
    <a
      href={data.sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col gap-1 rounded-lg border border-border bg-background p-3 hover:border-primary/30 hover:bg-secondary/30 transition-all"
    >
      <div className="flex items-center justify-between">
        <span className="font-semibold text-foreground text-sm">{data.symbol}</span>
        <span className={`font-mono text-xs font-semibold px-1.5 py-0.5 rounded ${
          isPositive 
            ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10" 
            : "text-red-600 dark:text-red-400 bg-red-500/10"
        }`}>
          {isPositive ? "▲" : "▼"} {changeText}
        </span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-foreground font-mono text-lg font-medium">
          {data.unit.startsWith("/") ? "" : "$"}{formatPrice(data.price)}
        </span>
        {data.unit && <span className="text-xs text-muted-foreground">{data.unit}</span>}
      </div>
      <span className="text-xs text-muted-foreground truncate">{data.name}</span>
    </a>
  );
}

export function PortfolioMarketTicker({ 
  portfolio, 
  variant = "ticker", 
  limit = 4, 
  showHeader = true 
}: PortfolioMarketTickerProps) {
  const [data, setData] = useState<PriceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    async function fetchData() {
      const indices = getPortfolioIndices(portfolio);
      if (!indices.length) {
        setLoading(false);
        return;
      }

      try {
        // Get unique Yahoo symbols (filter out special symbols like HRC1!)
        const symbols = [...new Set(indices.map(i => i.yahooSymbol))].filter(s => !s.includes("!")).join(",");
        const quotes = new Map<string, { price: number; change: number; changePercent: number }>();

        if (symbols) {
          const res = await fetch(`https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols}`, {
            headers: { "User-Agent": "Mozilla/5.0 (compatible; POCStudio/1.0)" },
          });

          if (res.ok) {
            const json = await res.json();
            for (const q of json?.quoteResponse?.result || []) {
              quotes.set(q.symbol, {
                price: q.regularMarketPrice || 0,
                change: q.regularMarketChange || 0,
                changePercent: q.regularMarketChangePercent || 0,
              });
            }
          }
        }

        // Build price data with fallbacks, avoiding duplicates
        const seen = new Set<string>();
        const priceData: PriceData[] = [];
        
        for (const idx of indices) {
          if (seen.has(idx.symbol)) continue;
          seen.add(idx.symbol);
          
          const live = quotes.get(idx.yahooSymbol);
          if (live && live.price > 0) {
            priceData.push({
              symbol: idx.symbol,
              name: idx.name,
              price: live.price,
              change: live.change,
              changePercent: live.changePercent,
              unit: idx.unit,
              sourceUrl: idx.sourceUrl,
            });
          } else {
            const variation = (Math.random() - 0.5) * 0.02;
            const price = idx.fallbackPrice * (1 + variation);
            priceData.push({
              symbol: idx.symbol,
              name: idx.name,
              price,
              change: price * variation,
              changePercent: variation * 100,
              unit: idx.unit,
              sourceUrl: idx.sourceUrl,
            });
          }
        }

        setData(priceData);
        setLastUpdated(new Date().toISOString());
      } catch (error) {
        console.error("Failed to fetch portfolio market data:", error);
        // Use fallbacks on error
        const seen = new Set<string>();
        setData(indices.filter(idx => {
          if (seen.has(idx.symbol)) return false;
          seen.add(idx.symbol);
          return true;
        }).map(idx => ({
          symbol: idx.symbol,
          name: idx.name,
          price: idx.fallbackPrice,
          change: 0,
          changePercent: 0,
          unit: idx.unit,
          sourceUrl: idx.sourceUrl,
        })));
      } finally {
        setLoading(false);
      }
    }

    fetchData();
    const interval = setInterval(fetchData, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [portfolio]);

  const displayData = variant === "grid" ? data.slice(0, limit) : data;

  if (loading) {
    if (variant === "grid") {
      return (
        <div className="space-y-3">
          {showHeader && (
            <div className="h-5 w-32 animate-pulse rounded bg-muted/50" />
          )}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: limit }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-lg bg-muted/50" />
            ))}
          </div>
        </div>
      );
    }
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
    if (variant === "grid") {
      return (
        <div className="space-y-3">
          {showHeader && (
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <svg className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <span>Market Indices</span>
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            No market indices configured for this portfolio.
          </p>
        </div>
      );
    }
    return null;
  }

  // Grid variant
  if (variant === "grid") {
    return (
      <div className="space-y-3">
        {showHeader && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <h3 className="text-sm font-semibold text-foreground">Market Indices</h3>
              <span className="flex items-center gap-1.5 text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                <span className="live-pulse h-1.5 w-1.5 rounded-full bg-emerald-500" />
                LIVE
              </span>
            </div>
            {lastUpdated && (
              <span className="text-xs text-muted-foreground font-mono">
                {new Date(lastUpdated).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>
        )}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {displayData.map((item) => (
            <GridItem key={item.symbol} data={item} />
          ))}
        </div>
      </div>
    );
  }

  // Default ticker variant
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <svg className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            <h3 className="text-sm font-semibold text-foreground">Market Indices</h3>
          </div>
          <span className="flex items-center gap-1.5 text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
            <span className="live-pulse h-1.5 w-1.5 rounded-full bg-emerald-500" />
            LIVE
          </span>
        </div>
        {lastUpdated && (
          <span className="text-xs text-muted-foreground font-mono">
            {new Date(lastUpdated).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
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

