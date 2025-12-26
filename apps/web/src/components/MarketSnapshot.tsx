import { MarketIndex } from "@proof/shared";

export function MarketSnapshot({ indices }: { indices: MarketIndex[] }) {
  if (!indices.length) return null;
  
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
            </svg>
          </div>
          <div>
            <h4 className="font-semibold text-foreground">Market Benchmarks</h4>
            <p className="text-sm text-muted-foreground">Regional market indicators and references</p>
          </div>
        </div>
        <span className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
          <span className="status-dot live" />
          Live feeds
        </span>
      </div>
      
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {indices.map((idx) => (
          <a
            key={idx.id}
            href={idx.url}
            target="_blank"
            rel="noreferrer"
            className="group flex flex-col gap-1.5 rounded-lg border border-border bg-background p-3 transition-all hover:border-primary/30 hover:shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="font-medium text-foreground group-hover:text-primary">{idx.label}</span>
              <svg className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
              </svg>
            </div>
            <p className="text-sm text-muted-foreground">{idx.notes}</p>
          </a>
        ))}
      </div>
    </section>
  );
}
