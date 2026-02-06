"use client";

import { useEffect, useMemo, useState } from "react";
import { formatTimestampWithTimezones } from "@/lib/format-time";

interface PriceData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  unit: string;
  sourceUrl: string;
  lastUpdated: string;
  state: "live" | "stale" | "fallback";
}

interface MarketDataResponse {
  success: boolean;
  data: PriceData[];
  timestamp: string;
  source: "live" | "mixed" | "fallback";
}

interface PortfolioMarketTickerProps {
  portfolio: string;
  variant?: "ticker" | "grid";
  limit?: number;
  showHeader?: boolean;
}

function formatPrice(price: number): string {
  if (price >= 1000) return price.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (price < 1) return price.toFixed(4);
  return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function statusMeta(data: PriceData[]) {
  if (data.length === 0) {
    return {
      label: "NO DATA",
      tone: "text-muted-foreground bg-muted/30"
    };
  }

  const live = data.filter((item) => item.state === "live").length;
  const stale = data.filter((item) => item.state === "stale").length;
  const fallback = data.filter((item) => item.state === "fallback").length;

  if (fallback === 0 && stale === 0) {
    return {
      label: "LIVE",
      tone: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
    };
  }
  if (live > 0) {
    return {
      label: "UPDATING",
      tone: "text-amber-600 dark:text-amber-400 bg-amber-500/10"
    };
  }
  return {
    label: "UPDATED",
    tone: "text-muted-foreground bg-muted/30"
  };
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

function GridItem({ data }: { data: PriceData }) {
  return (
    <a
      href={data.sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex min-w-0 flex-col gap-1 rounded-md border border-border bg-background p-2 hover:border-primary/30 hover:bg-secondary/30 transition-all"
    >
      <div className="flex items-center justify-between">
        <span className="font-semibold text-foreground text-xs truncate">{data.symbol}</span>
        <ChangeBadge changePercent={data.changePercent} />
      </div>
      <div className="flex min-w-0 items-baseline gap-1">
        <span className="text-foreground font-mono text-sm font-medium">
          {data.unit.startsWith("/") ? "" : "$"}
          {formatPrice(data.price)}
        </span>
        {data.unit ? <span className="text-[10px] text-muted-foreground">{data.unit}</span> : null}
      </div>
      <span className="text-[10px] text-muted-foreground truncate">{data.name}</span>
    </a>
  );
}

function TickerItem({ data }: { data: PriceData }) {
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
        {data.unit ? <span className="text-xs text-muted-foreground ml-0.5">{data.unit}</span> : null}
      </span>
      <ChangeBadge changePercent={data.changePercent} />
      <span className="ticker-separator text-border/50">│</span>
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
    let cancelled = false;

    const fetchData = async () => {
      try {
        const response = await fetch(`/api/market-data?portfolio=${encodeURIComponent(portfolio)}`);
        const json = (await response.json()) as MarketDataResponse;
        if (!cancelled && json.success) {
          setData(Array.isArray(json.data) ? json.data : []);
          setLastUpdated(json.timestamp ?? "");
        }
      } catch {
        if (!cancelled) {
          setData([]);
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
  }, [portfolio]);

  const displayData = useMemo(() => (variant === "grid" ? data.slice(0, limit) : data), [data, limit, variant]);
  const status = statusMeta(data);

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
      <div className="ticker-container">
        <div className="flex items-center gap-6 px-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-6 w-28 animate-pulse rounded bg-muted/50" />
          ))}
        </div>
      </div>
    );
  }

  if (displayData.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        Market indices are currently unavailable for this portfolio.
      </div>
    );
  }

  if (variant === "grid") {
    return (
      <div className="space-y-3">
        {showHeader ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-foreground">Market Indices</h3>
              {status.label ? <span className={`text-[10px] px-2 py-0.5 rounded-full ${status.tone}`}>{status.label}</span> : null}
            </div>
            {lastUpdated ? (
              <span className="text-[11px] text-muted-foreground font-mono">
                Last update: {formatTimestampWithTimezones(lastUpdated)}
              </span>
            ) : null}
          </div>
        ) : null}
        <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
          {displayData.map((item) => (
            <GridItem key={`${item.symbol}:${item.sourceUrl}`} data={item} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">Market Indices</h3>
          <span className={`text-[10px] px-2 py-0.5 rounded-full ${status.tone}`}>{status.label}</span>
        </div>
        {lastUpdated ? (
          <span className="text-xs text-muted-foreground font-mono">
            Last update: {formatTimestampWithTimezones(lastUpdated)}
          </span>
        ) : null}
      </div>

      <div className="ticker-container" onMouseEnter={() => setIsPaused(true)} onMouseLeave={() => setIsPaused(false)}>
        <div className={`ticker-track ${isPaused ? "paused" : ""}`}>
          <div className="ticker-content">
            {displayData.map((item) => (
              <TickerItem key={`a-${item.symbol}-${item.sourceUrl}`} data={item} />
            ))}
          </div>
          <div className="ticker-content">
            {displayData.map((item) => (
              <TickerItem key={`b-${item.symbol}-${item.sourceUrl}`} data={item} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
