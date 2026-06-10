"use client";

import { useEffect, useMemo, useState } from "react";
import type { MarketQuote } from "@/lib/market-data";
import { formatTimestampWithTimezones } from "@/lib/format-time";

/**
 * The one market ticker. Replaces the former LiveMarketTicker /
 * PortfolioMarketTicker / CategoryMarketTicker trio:
 * - `portfolio` scopes quotes to that portfolio's configured indices,
 * - `symbols` filters/orders the displayed quotes client-side,
 * - `variant="grid"` renders compact cards instead of the scrolling tape.
 */
interface MarketTickerProps {
  portfolio?: string;
  symbols?: string[];
  variant?: "ticker" | "grid";
  /** Max cards in grid variant. */
  limit?: number;
  showHeader?: boolean;
  initialData?: MarketQuote[];
  initialTimestamp?: string;
}

interface MarketDataResponse {
  success: boolean;
  data: MarketQuote[];
  timestamp: string;
  source: "live" | "mixed" | "fallback";
}

const REFRESH_INTERVAL_MS = 60 * 60 * 1000;

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

function ChangeBadge({ changePercent }: { changePercent: number }) {
  const positive = changePercent >= 0;
  const label = `${positive ? "+" : ""}${changePercent.toFixed(2)}%`;
  return (
    <span
      className={`font-mono text-xs font-semibold px-1.5 py-0.5 rounded ${
        positive
          ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
          : "text-red-600 dark:text-red-400 bg-red-500/10"
      }`}
    >
      {positive ? "▲" : "▼"} {label}
    </span>
  );
}

function GridItem({ quote }: { quote: MarketQuote }) {
  return (
    <a
      href={quote.sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex min-w-0 flex-col gap-1 rounded-md border border-border bg-background p-2 hover:border-primary/30 hover:bg-secondary/30 transition-all"
    >
      <div className="flex items-center justify-between">
        <span className="font-semibold text-foreground text-xs truncate">{quote.symbol}</span>
        <ChangeBadge changePercent={quote.changePercent} />
      </div>
      <div className="flex min-w-0 items-baseline gap-1">
        <span className="text-foreground font-mono text-sm font-medium">
          {quote.unit.startsWith("/") ? "" : "$"}
          {formatPrice(quote.price)}
        </span>
        {quote.unit ? <span className="text-[10px] text-muted-foreground">{quote.unit}</span> : null}
      </div>
      <span className="text-[10px] text-muted-foreground truncate">{quote.name}</span>
    </a>
  );
}

function TickerItem({ quote }: { quote: MarketQuote }) {
  return (
    <a
      href={quote.sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="ticker-item group flex items-center gap-3 px-4 py-2 whitespace-nowrap"
    >
      <span className="font-semibold text-foreground tracking-tight">{quote.symbol}</span>
      <span className="text-foreground/90 font-mono text-sm">
        {quote.unit.startsWith("/") ? "" : "$"}
        {formatPrice(quote.price)}
        {quote.unit ? <span className="text-xs text-muted-foreground ml-0.5">{quote.unit}</span> : null}
      </span>
      <ChangeBadge changePercent={quote.changePercent} />
      <span className="ticker-separator text-border/50">│</span>
    </a>
  );
}

export function MarketTicker({
  portfolio,
  symbols,
  variant = "ticker",
  limit = 4,
  showHeader = true,
  initialData,
  initialTimestamp
}: MarketTickerProps) {
  const hasInitialState = initialData !== undefined;
  const [quotes, setQuotes] = useState<MarketQuote[]>(initialData ?? []);
  const [loading, setLoading] = useState(!hasInitialState);
  const [lastUpdated, setLastUpdated] = useState<string>(initialTimestamp ?? "");
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        const url = portfolio
          ? `/api/market-data?portfolio=${encodeURIComponent(portfolio)}`
          : "/api/market-data";
        const response = await fetch(url);
        const json = (await response.json()) as MarketDataResponse;
        if (!cancelled && json.success) {
          setQuotes(Array.isArray(json.data) ? json.data : []);
          setLastUpdated(json.timestamp ?? "");
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
    const interval = setInterval(fetchData, REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [hasInitialState, portfolio]);

  const displayQuotes = useMemo(() => {
    let selected = quotes;
    if (symbols && symbols.length > 0) {
      selected = symbols
        .map((symbol) => quotes.find((quote) => quote.symbol === symbol))
        .filter((quote): quote is MarketQuote => Boolean(quote));
    }
    return variant === "grid" ? selected.slice(0, limit) : selected;
  }, [quotes, symbols, variant, limit]);

  const status = useMemo(() => statusMeta(displayQuotes), [displayQuotes]);

  if (loading) {
    if (variant === "grid") {
      return (
        <div className="space-y-3">
          {showHeader ? <div className="h-5 w-32 animate-pulse rounded bg-muted/50" /> : null}
          <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
            {Array.from({ length: limit }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-md bg-muted/50" />
            ))}
          </div>
        </div>
      );
    }
    return (
      <div className="ticker-container py-2">
        <div className="flex items-center gap-6 px-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-6 w-28 animate-pulse rounded bg-muted/50" />
          ))}
        </div>
      </div>
    );
  }

  if (displayQuotes.length === 0) {
    return <p className="text-sm text-muted-foreground">Market data is currently unavailable.</p>;
  }

  const header = showHeader ? (
    <div className="flex items-center justify-between px-1">
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
  ) : null;

  if (variant === "grid") {
    return (
      <div className="space-y-3">
        {header}
        <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
          {displayQuotes.map((quote) => (
            <GridItem key={`${quote.symbol}:${quote.sourceUrl}`} quote={quote} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {header}
      <div className="ticker-container" onMouseEnter={() => setIsPaused(true)} onMouseLeave={() => setIsPaused(false)}>
        <div className={`ticker-track ${isPaused ? "paused" : ""}`}>
          <div className="ticker-content">
            {displayQuotes.map((quote) => (
              <TickerItem key={`a-${quote.symbol}-${quote.sourceUrl}`} quote={quote} />
            ))}
          </div>
          <div className="ticker-content">
            {displayQuotes.map((quote) => (
              <TickerItem key={`b-${quote.symbol}-${quote.sourceUrl}`} quote={quote} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
