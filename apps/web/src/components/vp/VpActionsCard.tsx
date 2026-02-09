import type { ReactNode } from "react";
import Link from "next/link";
import { BriefPost, VpAction } from "@proof/shared";

function getEvidenceHref(brief: BriefPost, evidenceArticleIndex: number): string {
  const position = brief.selectedArticles?.findIndex((article) => article.sourceIndex === evidenceArticleIndex) ?? -1;
  const baseHref = `/brief/${encodeURIComponent(brief.postId)}`;
  if (position >= 0) {
    return `${baseHref}#article-${position + 1}`;
  }
  return baseHref;
}

function Badge({ children }: { children: ReactNode }) {
  return <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-foreground">{children}</span>;
}

export function VpActionsCard({ actions, brief }: { actions: VpAction[]; brief: BriefPost }) {
  if (!actions || actions.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Recommended actions</h3>
        <span className="text-xs text-muted-foreground">{actions.length} items</span>
      </div>
      <div className="space-y-3">
        {actions.map((actionItem, idx) => (
          <div key={`${actionItem.action}-${idx}`} className="rounded-md border border-border/60 bg-muted/30 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">{actionItem.action}</p>
              <div className="flex flex-wrap gap-2 justify-end">
                <Badge>{actionItem.ownerRole}</Badge>
                <Badge>Due in {actionItem.dueInDays} days</Badge>
                <Badge>{actionItem.confidence}</Badge>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">{actionItem.expectedImpact}</p>
            <Link
              href={getEvidenceHref(brief, actionItem.evidenceArticleIndex)}
              className="text-xs font-medium text-primary hover:underline"
            >
              Evidence →
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
