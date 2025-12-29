import Link from "next/link";
import { ExecutiveDashboardPayload, ExecutiveIndex } from "../lib/executive-dashboard";

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

function formatNumber(value: number): string {
  if (Math.abs(value) >= 1000) {
    return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
  }
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatChange(change: number, changePercent: number): { text: string; isPositive: boolean } {
  const sign = change >= 0 ? "+" : "";
  return {
    text: `${sign}${change.toFixed(2)} (${sign}${changePercent.toFixed(2)}%)`,
    isPositive: change >= 0,
  };
}

function buildPolyline(series: ExecutiveIndex["series"], min: number, max: number, width: number, height: number): string {
  const range = max - min || 1;
  const stepX = width / Math.max(series.length - 1, 1);

  return series
    .map((point, idx) => {
      const x = idx * stepX;
      const normalized = (point.value - min) / range;
      const y = height - normalized * height;
      return `${x},${y}`;
    })
    .join(" ");
}

function CategoryBadge({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
      {label}
    </span>
  );
}

function MarketPulseSparkline({ commodity }: { commodity: CommodityPrice }) {
  const height = 48;
  const width = 140;
  const { text, isPositive } = formatChange(commodity.change, commodity.changePercent);
  
  // Create a simple sparkline series from current price and change
  // Generate a simple trend line based on the change
  const seriesLength = 10;
  const basePrice = commodity.price - commodity.change;
  const series = Array.from({ length: seriesLength }, (_, i) => {
    const progress = i / (seriesLength - 1);
    const value = basePrice + (commodity.change * progress);
    return { date: new Date(Date.now() - (seriesLength - 1 - i) * 86400000).toISOString(), value };
  });
  
  const min = Math.min(...series.map((p) => p.value));
  const max = Math.max(...series.map((p) => p.value));
  const path = buildPolyline(series, min, max, width, height);

  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-card/60 p-3">
      <div>
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          {commodity.name}
          <span className="text-xs text-muted-foreground">{commodity.unit}</span>
        </div>
        <div className="text-sm font-medium text-muted-foreground">{text}</div>
      </div>
      <div className="flex items-center gap-2">
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="text-primary">
          <polyline
            fill="none"
            stroke={isPositive ? "#10b981" : "#ef4444"}
            strokeWidth={2}
            points={path}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <div className="text-right">
          <div className="text-lg font-semibold text-foreground">
            {commodity.currency === "USD" && "$"}
            {formatNumber(commodity.price)}
          </div>
          <div className={`text-xs ${isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
            {text}
          </div>
        </div>
      </div>
    </div>
  );
}

function HeadlineList({ items }: { items: ExecutiveDashboardPayload["articles"] }) {
  return (
    <div className="space-y-3">
      {items.map((article) => (
        <Link
          key={`${article.source}-${article.title}`}
          href={article.url}
          className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card/70 p-3 transition hover:border-primary/40 hover:shadow-sm"
          target="_blank"
        >
          <div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CategoryBadge label={article.category} />
              <span>{article.source}</span>
              <span>•</span>
              <span>{new Date(article.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
            </div>
            <p className="mt-1 text-sm font-semibold leading-snug text-foreground">{article.title}</p>
            {article.summary && <p className="text-xs text-muted-foreground">{article.summary}</p>}
          </div>
          <svg className="mt-1 h-4 w-4 text-muted-foreground" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M7 5h8M7 10h8M7 15h8M5 5h.01M5 10h.01M5 15h.01" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      ))}
    </div>
  );
}

export function ExecutiveDashboard({ 
  data, 
  marketData 
}: { 
  data: ExecutiveDashboardPayload;
  marketData: CommodityPrice[];
}) {
  return (
    <section className="space-y-4 rounded-2xl border border-border bg-background/80 p-5 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Executive dashboard</p>
          <h2 className="text-2xl font-bold text-foreground">Category Management</h2>
          <p className="text-sm text-muted-foreground">Market pulse data for category managers.</p>
        </div>
        <div className="text-xs text-muted-foreground">
          Updated {new Date(data.generatedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">Category view</h3>
            <span className="text-xs text-muted-foreground">Market pulse with sparkline</span>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {marketData.map((commodity) => (
              <MarketPulseSparkline key={commodity.symbol} commodity={commodity} />
            ))}
          </div>
        </div>
        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Energy headlines</h3>
              <p className="text-sm text-muted-foreground">Linked to free industry feeds</p>
            </div>
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Top 10</span>
          </div>
          <HeadlineList items={data.articles} />
          <p className="text-[10px] text-muted-foreground">Sources: {data.sources.news}</p>
        </div>
      </div>
    </section>
  );
}
