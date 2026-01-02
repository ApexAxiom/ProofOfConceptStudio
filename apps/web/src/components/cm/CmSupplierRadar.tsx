import Link from "next/link";
import { BriefPost } from "@proof/shared";
import { cmEvidenceLink } from "./cmEvidenceLink";

interface CmSupplierRadarProps {
  brief?: BriefPost;
}

const DEFAULT_VISIBLE = 3;

export function CmSupplierRadar({ brief }: CmSupplierRadarProps) {
  const supplierSignals = brief?.cmSnapshot?.supplierRadar ?? [];
  const fallbackWatchlist = supplierSignals.length === 0 ? brief?.watchlist ?? [] : [];

  const hasData = supplierSignals.length > 0 || fallbackWatchlist.length > 0;

  const visibleSignals = supplierSignals.slice(0, DEFAULT_VISIBLE);
  const hiddenSignals = supplierSignals.slice(DEFAULT_VISIBLE);

  const visibleWatchlist = fallbackWatchlist.slice(0, DEFAULT_VISIBLE);
  const hiddenWatchlist = fallbackWatchlist.slice(DEFAULT_VISIBLE);

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200">
          🛰️
        </span>
        <span>Supplier radar</span>
      </div>

      {!hasData && (
        <p className="text-sm text-muted-foreground">
          No data yet. This will populate after the next brief run.
        </p>
      )}

      {supplierSignals.length > 0 && (
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            {visibleSignals.map((item, idx) => (
              <div key={`${item.supplier}-${idx}`} className="rounded-lg border border-border bg-background p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">{item.supplier || "Supplier update"}</p>
                  <span className="text-xs capitalize text-muted-foreground">{item.confidence} confidence</span>
                </div>
                <p className="text-sm text-foreground">{item.signal}</p>
                <p className="text-sm text-muted-foreground">{item.implication}</p>
                <div className="flex items-center justify-between text-xs text-foreground">
                  <span className="font-medium">Next: {item.nextStep}</span>
                  <Link href={cmEvidenceLink(brief, item.evidenceArticleIndex)} className="text-primary hover:underline">
                    Evidence
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {hiddenSignals.length > 0 && (
            <details className="group">
              <summary className="text-xs text-primary cursor-pointer hover:underline list-none flex items-center gap-1">
                <svg className="h-3 w-3 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
                Show {hiddenSignals.length} more
              </summary>
              <div className="grid gap-3 md:grid-cols-2 mt-3">
                {hiddenSignals.map((item, idx) => (
                  <div key={`hidden-${item.supplier}-${idx}`} className="rounded-lg border border-border bg-background p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-foreground">{item.supplier || "Supplier update"}</p>
                      <span className="text-xs capitalize text-muted-foreground">{item.confidence} confidence</span>
                    </div>
                    <p className="text-sm text-foreground">{item.signal}</p>
                    <p className="text-sm text-muted-foreground">{item.implication}</p>
                    <div className="flex items-center justify-between text-xs text-foreground">
                      <span className="font-medium">Next: {item.nextStep}</span>
                      <Link href={cmEvidenceLink(brief, item.evidenceArticleIndex)} className="text-primary hover:underline">
                        Evidence
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {supplierSignals.length === 0 && fallbackWatchlist.length > 0 && (
        <div className="space-y-2">
          {visibleWatchlist.map((item, idx) => (
            <div key={`${item}-${idx}`} className="flex items-start gap-2 rounded-md bg-muted/40 px-3 py-2 text-sm">
              <span className="mt-1 h-2 w-2 rounded-full bg-amber-500" aria-hidden />
              <span className="text-foreground">{item}</span>
            </div>
          ))}

          {hiddenWatchlist.length > 0 && (
            <details className="group">
              <summary className="text-xs text-primary cursor-pointer hover:underline list-none flex items-center gap-1">
                <svg className="h-3 w-3 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
                Show {hiddenWatchlist.length} more
              </summary>
              <div className="space-y-2 mt-2">
                {hiddenWatchlist.map((item, idx) => (
                  <div key={`hidden-${item}-${idx}`} className="flex items-start gap-2 rounded-md bg-muted/40 px-3 py-2 text-sm">
                    <span className="mt-1 h-2 w-2 rounded-full bg-amber-500" aria-hidden />
                    <span className="text-foreground">{item}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
