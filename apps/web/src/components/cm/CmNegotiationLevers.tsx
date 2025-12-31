import Link from "next/link";
import { BriefPost } from "@proof/shared";
import { cmEvidenceLink } from "./cmEvidenceLink";

interface CmNegotiationLeversProps {
  brief?: BriefPost;
}

export function CmNegotiationLevers({ brief }: CmNegotiationLeversProps) {
  const levers = brief?.cmSnapshot?.negotiationLevers ?? [];

  if (levers.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-200">
          🎯
        </span>
        <span>Negotiation levers</span>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {levers.map((lever, idx) => (
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
    </div>
  );
}
