"use client";

import { useEffect, useMemo, useState } from "react";
import { formatTimestampWithTimezones } from "@/lib/format-time";

interface MarketQuote {
  symbol: string;
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
  data: MarketQuote[];
  timestamp: string;
  source: "live" | "mixed" | "fallback";
}

function formatPrice(price: number): string {
  if (price >= 1000) return price.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (price < 1) return price.toFixed(4);
  return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function statusMeta(quotes: MarketQuote[]) {
  const live = quotes.filter((quote) => quote.state === "live").length;
  const stale = quotes.filter((quote) => quote.state === "stale").length;
  const fallback = quotes.filter((quote) => quote.state === "fallback").length;

  if (quotes.length > 0 && stale === 0 && fallback === 0) {
    return { label: "LIVE", tone: "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20" };
  }
  if (live > 0) {
    return { label: "UPDATING", tone: "text-amber-400 bg-amber-500/10 border border-amber-500/20" };
  }
  return { label: "CACHED", tone: "text-muted-foreground bg-muted/30 border border-border" };
}

function TickerItem({ quote }: { quote: MarketQuote }) {
  const positive = quote.changePercent >= 0;
  const changeText = `${positive ? "+" : ""}${quote.changePercent.toFixed(2)}%`;
  return (
    <a
      href={quote.sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="ticker-item group flex items-center gap-4 whitespace-nowrap"
    >
      <span className="font-mono text-xs font-semibold text-muted-foreground group-hover:text-foreground transition-colors tracking-wider">
        {quote.symbol}
      </span>
      <span className="font-mono text-sm font-semibold text-foreground">
        {quote.unit.startsWith("/") ? "" : "$"}
        {formatPrice(quote.price)}
      </span>
      <span
        className={`font-mono text-xs font-bold px-2 py-0.5 rounded-md ${
          positive
            ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20"
            : "text-red-400 bg-red-500/10 border border-red-500/20"
        }`}
      >
        <span className="mr-1">{positive ? "▲" : "▼"}</span>
        {changeText}
      </span>
    </a>
  );
}

export function LiveMarketTicker({ showHeader = true }: { showHeader?: boolean }) {
  const [quotes, setQuotes] = useState<MarketQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        const response = await fetch("/api/market-data");
        const json = (await response.json()) as MarketDataResponse;
        if (!cancelled && json.success) {
          setQuotes(Array.isArray(json.data) ? json.data : []);
          setLastUpdated(json.timestamp);
        }
      } catch {
        if (!cancelled) {
          setQuotes([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 60 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const status = useMemo(() => statusMeta(quotes), [quotes]);

  if (loading) {
    return (
      <div className="ticker-container py-4">
        <div className="flex items-center gap-8 px-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
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

  if (quotes.length === 0) {
    return <p className="text-sm text-muted-foreground">Market data is currently unavailable.</p>;
  }

  return (
    <div className="space-y-3">
      {showHeader ? (
        <div className="flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <h3 className="font-display text-sm font-semibold text-foreground">Market Indices</h3>
            <span className={`text-[9px] font-bold uppercase tracking-[0.15em] px-2 py-1 rounded-full ${status.tone}`}>
              {status.label}
            </span>
          </div>
          {lastUpdated ? (
            <span className="text-[10px] font-mono text-muted-foreground">
              Last update: {formatTimestampWithTimezones(lastUpdated)}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="ticker-container" onMouseEnter={() => setIsPaused(true)} onMouseLeave={() => setIsPaused(false)}>
        <div className={`ticker-track ${isPaused ? "paused" : ""}`}>
          <div className="ticker-content">
            {quotes.map((quote) => (
              <TickerItem key={`a-${quote.symbol}-${quote.sourceUrl}`} quote={quote} />
            ))}
          </div>
          <div className="ticker-content">
            {quotes.map((quote) => (
              <TickerItem key={`b-${quote.symbol}-${quote.sourceUrl}`} quote={quote} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

