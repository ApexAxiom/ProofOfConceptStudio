"use client";

import { BriefMarketSnapshotItem } from "@proof/shared";

function formatChange(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${Math.abs(value).toFixed(2)}`;
}

/**
 * Renders market snapshot tiles for portfolio indices.
 */
export function MarketSnapshotTiles({ items }: { items: BriefMarketSnapshotItem[] }) {
  if (!items.length) return null;

  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Market Snapshot</p>
          <h4 className="text-sm font-semibold text-foreground">Live portfolio benchmarks</h4>
        </div>
        <span className="text-xs text-muted-foreground">Source: Yahoo Finance</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => {
          const changePositive = item.change >= 0;
          const dataState = item.dataState ?? (item.isFallback ? "fallback" : "live");
          const dataStateLabel = dataState === "cached" ? "delayed" : dataState;
          return (
            <div key={`${item.symbol}-${item.name}`} className="rounded-lg border border-border bg-background p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-foreground">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.symbol}</p>
                </div>
                <a
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-primary hover:underline"
                >
                  Source
                </a>
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-lg font-semibold text-foreground">
                    {item.latest.toFixed(2)} {item.unit}
                  </p>
                  <p className="text-xs text-muted-foreground">As of {new Date(item.asOf).toLocaleDateString()}</p>
                </div>
                <div className={`text-sm font-semibold ${changePositive ? "text-emerald-600" : "text-rose-600"}`}>
                  {formatChange(item.change)} ({formatChange(item.changePercent)}%)
                </div>
              </div>
              {(item.dataState || item.isFallback) && (
                <p className="text-xs text-amber-500">Data state: {dataStateLabel}</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
