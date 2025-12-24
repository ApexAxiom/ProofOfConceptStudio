import { MarketIndex } from "@proof/shared";

export function MarketSnapshot({ indices }: { indices: MarketIndex[] }) {
  if (!indices.length) return null;
  return (
    <section className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-base font-semibold text-slate-900">Market Snapshot</h4>
        <span className="text-xs text-slate-500">Regional indices</span>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {indices.map((idx) => (
          <a
            key={idx.id}
            href={idx.url}
            target="_blank"
            rel="noreferrer"
            className="flex h-full flex-col gap-1 rounded-xl border border-slate-200 p-3 transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow"
          >
            <div className="font-semibold text-slate-900">{idx.label}</div>
            <div className="text-xs text-slate-600">{idx.notes}</div>
          </a>
        ))}
      </div>
    </section>
  );
}
