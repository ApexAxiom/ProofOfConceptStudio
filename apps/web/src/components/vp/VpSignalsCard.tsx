import type { ReactNode } from "react";
import Link from "next/link";
import { BriefPost, VpSignal } from "@proof/shared";

function getEvidenceHref(brief: BriefPost, evidenceArticleIndex: number): string {
  const position = brief.selectedArticles?.findIndex((article) => article.sourceIndex === evidenceArticleIndex) ?? -1;
  if (position >= 0) {
    return `/brief/${brief.postId}#article-${position + 1}`;
  }
  return `/brief/${brief.postId}`;
}

function Badge({ children }: { children: ReactNode }) {
  return <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-foreground">{children}</span>;
}

export function VpSignalsCard({ signals, brief }: { signals: VpSignal[]; brief: BriefPost }) {
  if (!signals || signals.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Top signals</h3>
        <span className="text-xs text-muted-foreground">{signals.length} items</span>
      </div>
      <div className="space-y-3">
        {signals.map((signal, idx) => (
          <div key={`${signal.title}-${idx}`} className="rounded-md border border-border/60 bg-muted/30 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">{signal.title}</p>
              <div className="flex flex-wrap gap-2 justify-end">
                <Badge>{signal.type}</Badge>
                <Badge>{signal.horizon}</Badge>
                <Badge>{signal.confidence}</Badge>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">{signal.impact}</p>
            <Link href={getEvidenceHref(brief, signal.evidenceArticleIndex)} className="text-xs font-medium text-primary hover:underline">
              Evidence →
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
