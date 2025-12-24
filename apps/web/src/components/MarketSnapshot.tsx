import { MarketIndex } from "@proof/shared";

export function MarketSnapshot({ indices }: { indices: MarketIndex[] }) {
  if (!indices.length) return null;
  
  return (
    <section className="rounded-2xl border border-slate-700/50 bg-slate-900/50 p-6">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
            </svg>
          </div>
          <div>
            <h4 className="text-lg font-semibold text-white">Market Indices</h4>
            <p className="text-sm text-slate-400">Regional market indicators and benchmarks</p>
          </div>
        </div>
        <span className="flex items-center gap-2 text-xs text-emerald-400">
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
            className="group flex flex-col gap-2 rounded-xl border border-slate-700/50 bg-slate-800/30 p-4 transition-all hover:-translate-y-0.5 hover:border-emerald-500/30 hover:bg-slate-800/50 hover:shadow-lg hover:shadow-emerald-500/5"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="font-semibold text-white group-hover:text-emerald-300">{idx.label}</span>
              <svg className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
              </svg>
            </div>
            <p className="text-sm text-slate-400">{idx.notes}</p>
          </a>
        ))}
      </div>
    </section>
  );
}
