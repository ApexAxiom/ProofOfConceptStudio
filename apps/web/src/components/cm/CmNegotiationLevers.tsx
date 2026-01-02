import Link from "next/link";
import { BriefPost } from "@proof/shared";
import { cmEvidenceLink } from "./cmEvidenceLink";

interface CmNegotiationLeversProps {
  brief?: BriefPost;
}

const DEFAULT_VISIBLE = 3;

export function CmNegotiationLevers({ brief }: CmNegotiationLeversProps) {
  const levers = brief?.cmSnapshot?.negotiationLevers ?? [];

  const visibleLevers = levers.slice(0, DEFAULT_VISIBLE);
  const hiddenLevers = levers.slice(DEFAULT_VISIBLE);

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-200">
          🎯
        </span>
        <span>Negotiation levers</span>
      </div>

      {levers.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No data yet. This will populate after the next brief run.
        </p>
      )}

      {levers.length > 0 && (
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            {visibleLevers.map((lever, idx) => (
              <div key={`${lever.lever}-${idx}`} className="rounded-lg border border-border bg-background p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">{lever.lever}</p>
                  <span className="text-xs capitalize text-muted-foreground">{lever.confidence} confidence</span>
                </div>
                <p className="text-sm text-muted-foreground">Use when: {lever.whenToUse}</p>
                <p className="text-sm text-foreground">Outcome: {lever.expectedOutcome}</p>
                <div className="flex items-center justify-between text-xs text-primary">
                  <Link href={cmEvidenceLink(brief, lever.evidenceArticleIndex)} className="hover:underline">
                    Evidence
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {hiddenLevers.length > 0 && (
            <details className="group">
              <summary className="text-xs text-primary cursor-pointer hover:underline list-none flex items-center gap-1">
                <svg className="h-3 w-3 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
                Show {hiddenLevers.length} more
              </summary>
              <div className="grid gap-3 md:grid-cols-2 mt-3">
                {hiddenLevers.map((lever, idx) => (
                  <div key={`hidden-${lever.lever}-${idx}`} className="rounded-lg border border-border bg-background p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-foreground">{lever.lever}</p>
                      <span className="text-xs capitalize text-muted-foreground">{lever.confidence} confidence</span>
                    </div>
                    <p className="text-sm text-muted-foreground">Use when: {lever.whenToUse}</p>
                    <p className="text-sm text-foreground">Outcome: {lever.expectedOutcome}</p>
                    <div className="flex items-center justify-between text-xs text-primary">
                      <Link href={cmEvidenceLink(brief, lever.evidenceArticleIndex)} className="hover:underline">
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
    </div>
  );
}
