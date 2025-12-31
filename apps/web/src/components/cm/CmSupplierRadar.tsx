import Link from "next/link";
import { BriefPost } from "@proof/shared";
import { cmEvidenceLink } from "./cmEvidenceLink";

interface CmSupplierRadarProps {
  brief?: BriefPost;
}

export function CmSupplierRadar({ brief }: CmSupplierRadarProps) {
  const supplierSignals = brief?.cmSnapshot?.supplierRadar ?? [];
  const fallbackWatchlist = supplierSignals.length === 0 ? brief?.watchlist ?? [] : [];

  if (supplierSignals.length === 0 && fallbackWatchlist.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200">
          🛰️
        </span>
        <span>Supplier radar</span>
      </div>

      {supplierSignals.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {supplierSignals.map((item, idx) => (
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
      )}

      {supplierSignals.length === 0 && fallbackWatchlist.length > 0 && (
        <div className="space-y-2">
          {fallbackWatchlist.map((item, idx) => (
            <div key={`${item}-${idx}`} className="flex items-start gap-2 rounded-md bg-muted/40 px-3 py-2 text-sm">
              <span className="mt-1 h-2 w-2 rounded-full bg-amber-500" aria-hidden />
              <span className="text-foreground">{item}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
