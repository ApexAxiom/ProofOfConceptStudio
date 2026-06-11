"use client";

import { useEffect, useMemo, useState } from "react";
import { formatTimestampWithTimezones } from "@/lib/format-time";
import { EmptyState } from "./EmptyState";

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
    return { label: "LIVE", tone: "text-emerald-700 bg-emerald-500/10 border border-emerald-600/20 dark:text-emerald-400" };
  }
  if (live > 0) {
    return { label: "UPDATING", tone: "text-amber-700 bg-amber-500/10 border border-amber-600/20 dark:text-amber-400" };
  }
  return { label: "CACHED", tone: "text-muted-foreground bg-muted/30 border border-border" };
}

function TickerItem({ quote }: { quote: MarketQuote }) {
  const positive = quote.changePercent >= 0;
  const changeText = `${positive ? "+" : ""}${quote.changePercent.toFixed(2)}%`;
  return (
    <a href={quote.sourceUrl} target="_blank" rel="noopener noreferrer" className="ticker-item group">
      <span className="flex flex-col gap-0.5">
        <span className="font-mono text-xs font-semibold tracking-wider text-muted-foreground transition-colors group-hover:text-foreground">
          {quote.symbol}
        </span>
        <span className="font-mono text-sm font-semibold text-foreground">
          {quote.unit.startsWith("/") ? "" : "$"}
          {formatPrice(quote.price)}
        </span>
      </span>
      <span
        className={`font-mono text-xs font-semibold ${
          positive ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"
        }`}
      >
        {positive ? "▲" : "▼"} {changeText}
      </span>
    </a>
  );
}

export function LiveMarketTicker({
  showHeader = true,
  symbols,
  initialData,
  initialTimestamp
}: {
  showHeader?: boolean;
  symbols?: string[];
  initialData?: MarketQuote[];
  initialTimestamp?: string;
}) {
  const hasInitialState = initialData !== undefined;
  const [quotes, setQuotes] = useState<MarketQuote[]>(initialData ?? []);
  const [loading, setLoading] = useState(!hasInitialState);
  const [lastUpdated, setLastUpdated] = useState<string>(initialTimestamp ?? "");

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

    if (!hasInitialState) {
      void fetchData();
    }
    const interval = setInterval(fetchData, 60 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [hasInitialState]);

  const displayQuotes = useMemo(() => {
    if (!symbols || symbols.length === 0) return quotes;
    return symbols
      .map((symbol) => quotes.find((quote) => quote.symbol === symbol))
      .filter((quote): quote is MarketQuote => Boolean(quote));
  }, [quotes, symbols]);

  const status = useMemo(() => statusMeta(displayQuotes), [displayQuotes]);

  if (loading) {
    return (
      <div className="ticker-grid" aria-hidden="true">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-md bg-muted/60" />
        ))}
      </div>
    );
  }

  if (displayQuotes.length === 0) {
    return (
      <EmptyState
        compact
        title="Benchmarks updating"
        hint="Live commodity quotes refresh hourly and will appear here shortly."
      />
    );
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

      <div className="ticker-grid">
        {displayQuotes.map((quote) => (
          <TickerItem key={`${quote.symbol}-${quote.sourceUrl}`} quote={quote} />
        ))}
      </div>
    </div>
  );
}
