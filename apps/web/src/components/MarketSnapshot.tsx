import { MarketIndex } from "@proof/shared";

export function MarketSnapshot({ indices }: { indices: MarketIndex[] }) {
  if (!indices.length) return null;
  return (
    <section className="bg-white p-4 rounded border">
      <h4 className="font-semibold mb-3">Market Snapshot</h4>
      <div className="grid md:grid-cols-2 gap-3">
        {indices.map((idx) => (
          <a key={idx.id} href={idx.url} target="_blank" rel="noreferrer" className="block border p-3 rounded hover:shadow">
            <div className="font-semibold">{idx.label}</div>
            <div className="text-xs text-gray-600">{idx.notes}</div>
          </a>
        ))}
      </div>
    </section>
  );
}
