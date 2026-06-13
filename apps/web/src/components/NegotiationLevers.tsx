import React from "react";
import { BriefPost } from "@proof/shared";

const DEFAULT_VISIBLE = 3;

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
        <li key={`${item.lever}-${idx}`} className="space-y-2 rounded-lg border border-border bg-background px-3 py-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Lever</p>
            <p className="text-sm font-semibold text-foreground">{item.lever}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Use when</p>
            <p className="text-sm text-muted-foreground">{item.whenToUse}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Expected outcome</p>
            <p className="text-sm text-muted-foreground">{item.expectedOutcome}</p>
          </div>
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{item.confidence} confidence</p>
        </li>
      ))}
    </ul>
  );
}

