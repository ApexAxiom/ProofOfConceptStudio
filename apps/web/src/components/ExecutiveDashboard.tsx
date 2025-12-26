import Link from "next/link";
import { ExecutiveDashboardPayload, ExecutiveIndex } from "../lib/executive-dashboard";

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

function normalizeSeries(indices: ExecutiveIndex[]): { min: number; max: number } {
  const allValues = indices.flatMap((index) => index.series.map((point) => point.value));
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  return { min, max };
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

function Sparkline({ index }: { index: ExecutiveIndex }) {
  const height = 48;
  const width = 140;
  const min = Math.min(...index.series.map((p) => p.value));
  const max = Math.max(...index.series.map((p) => p.value));
  const path = buildPolyline(index.series, min, max, width, height);
  const { text, isPositive } = formatChange(index.change, index.changePercent);

  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-card/60 p-3">
      <div>
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          {index.name}
          <span className="text-xs text-muted-foreground">{index.unit}</span>
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
          <div className="text-lg font-semibold text-foreground">{formatNumber(index.latest)}</div>
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

function MultiLineChart({ indices }: { indices: ExecutiveIndex[] }) {
  const width = 760;
  const height = 240;
  const { min, max } = normalizeSeries(indices);
  const palette = ["#2563eb", "#ea580c", "#059669", "#16a34a", "#c026d3", "#f59e0b", "#6366f1"];
  const dates = indices[0]?.series.map((point) => new Date(point.date));

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Six-Month Benchmarks</h3>
          <p className="text-sm text-muted-foreground">Crude, gas, LNG, freight, equities, and macro indices</p>
        </div>
        <span className="text-xs text-muted-foreground">Source: free spark feeds, refreshed daily</span>
      </div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="w-full flex-1 text-primary">
          <defs>
            <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#60a5fa" stopOpacity="0" />
            </linearGradient>
          </defs>
          {indices.map((index, idx) => (
            <polyline
              key={index.symbol}
              fill="none"
              stroke={palette[idx % palette.length]}
              strokeWidth={2}
              points={buildPolyline(index.series, min, max, width, height)}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {dates && dates.length > 1 && (
            <g className="text-muted-foreground">
              <text x="0" y={height - 4} className="text-[10px] fill-current">
                {dates[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </text>
              <text x={width - 40} y={height - 4} className="text-[10px] fill-current">
                {dates.at(-1)?.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </text>
            </g>
          )}
        </svg>
        <div className="flex w-full flex-1 flex-col gap-3 lg:max-w-xs">
          {indices.map((index, idx) => {
            const { text, isPositive } = formatChange(index.change, index.changePercent);
            const color = palette[idx % palette.length];
            return (
              <div key={index.symbol} className="flex items-center justify-between rounded-lg border border-border bg-muted/40 p-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                  {index.name}
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold text-foreground">{formatNumber(index.latest)}</div>
                  <div className={`text-xs ${isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                    {text}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function ExecutiveDashboard({ data }: { data: ExecutiveDashboardPayload }) {
  const crudeAndGas = data.indices.filter((idx) => ["crude", "gas", "lng"].includes(idx.category));
  const transportAndMacro = data.indices.filter((idx) => ["shipping", "equities", "macro"].includes(idx.category));

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-background/80 p-5 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Executive dashboard</p>
          <h2 className="text-2xl font-bold text-foreground">Six-month energy pulse</h2>
          <p className="text-sm text-muted-foreground">Price history and headline flow curated for oil & gas leadership.</p>
        </div>
        <div className="text-xs text-muted-foreground">
          Updated {new Date(data.generatedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>

      <MultiLineChart indices={data.indices} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">Category view</h3>
            <span className="text-xs text-muted-foreground">6-month change with sparkline</span>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {crudeAndGas.map((index) => (
              <Sparkline key={index.symbol} index={index} />
            ))}
            {transportAndMacro.map((index) => (
              <Sparkline key={index.symbol} index={index} />
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
