import type { ReactNode } from "react";
import Link from "next/link";
import { BriefPost, VpRisk } from "@proof/shared";

function getEvidenceHref(brief: BriefPost, evidenceArticleIndex?: number): string {
  const baseHref = `/brief/${encodeURIComponent(brief.postId)}`;
  if (typeof evidenceArticleIndex === "number") {
    const position = brief.selectedArticles?.findIndex((article) => article.sourceIndex === evidenceArticleIndex) ?? -1;
    if (position >= 0) {
      return `${baseHref}#article-${position + 1}`;
    }
  }
  return baseHref;
}

function Badge({ children }: { children: ReactNode }) {
  return <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-foreground">{children}</span>;
}

export function VpRiskCard({ risks, brief }: { risks: VpRisk[]; brief: BriefPost }) {
  if (!risks || risks.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Risk register</h3>
        <span className="text-xs text-muted-foreground">{risks.length} items</span>
      </div>
      <div className="space-y-3">
        {risks.map((risk, idx) => (
          <div key={`${risk.risk}-${idx}`} className="rounded-md border border-border/60 bg-muted/30 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">{risk.risk}</p>
              <div className="flex flex-wrap gap-2 justify-end">
                <Badge>Prob: {risk.probability}</Badge>
                <Badge>Impact: {risk.impact}</Badge>
                <Badge>{risk.horizon}</Badge>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Mitigation: {risk.mitigation}</p>
            <p className="text-sm text-muted-foreground">Trigger: {risk.trigger}</p>
            <Link href={getEvidenceHref(brief, risk.evidenceArticleIndex)} className="text-xs font-medium text-primary hover:underline">
              Evidence →
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
