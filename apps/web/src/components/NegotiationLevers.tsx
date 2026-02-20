import React from "react";
import { BriefPost } from "@proof/shared";

const DEFAULT_VISIBLE = 5;

interface NegotiationLeversProps {
  brief?: BriefPost;
}

export function NegotiationLevers({ brief }: NegotiationLeversProps): React.ReactElement | null {
  const items = brief?.cmSnapshot?.negotiationLevers ?? [];
  if (items.length === 0) return null;

  const visibleItems = items.slice(0, DEFAULT_VISIBLE);

  return (
    <ul className="mt-3 space-y-2 text-sm text-foreground">
      {visibleItems.map((item, idx) => (
        <li key={`${item.lever}-${idx}`} className="rounded-lg border border-border bg-background px-3 py-2">
          <p className="text-sm font-semibold text-foreground">
            {item.lever} — {item.whenToUse} — {item.expectedOutcome}
          </p>
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{item.confidence} confidence</p>
        </li>
      ))}
    </ul>
  );
}

