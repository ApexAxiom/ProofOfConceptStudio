"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BriefPost } from "@proof/shared";
import { cmEvidenceLink } from "./cmEvidenceLink";

interface CmTodayPanelProps {
  brief?: BriefPost;
}

export function CmTodayPanel({ brief }: CmTodayPanelProps) {
  const priorities = brief?.cmSnapshot?.todayPriorities ?? [];
  const fallbackActions = priorities.length === 0 ? brief?.procurementActions ?? [] : [];
  const [copied, setCopied] = useState(false);

  const checklist = useMemo(() => {
    if (priorities.length > 0) {
      return priorities.map((item) => `- [ ] ${item.title} (due in ${item.dueInDays}d, ${item.confidence}) — ${item.why}`);
    }
    return fallbackActions.map((action) => `- [ ] ${action}`);
  }, [priorities, fallbackActions]);

  const copy = async () => {
    if (checklist.length === 0) return;
    await navigator.clipboard.writeText(checklist.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">⚡</span>
          <span>Today&apos;s priorities</span>
        </div>
        <button
          type="button"
          onClick={copy}
          disabled={checklist.length === 0}
          className="btn-secondary px-3 py-1 text-xs disabled:opacity-50"
        >
          {copied ? "Copied" : "Copy as checklist"}
        </button>
      </div>

      {priorities.length === 0 && fallbackActions.length === 0 && (
        <p className="text-sm text-muted-foreground">No priorities yet. Actions will appear after the next brief.</p>
      )}

      {priorities.length > 0 && (
        <div className="space-y-3">
          {priorities.map((item, idx) => (
            <div
              key={`${item.title}-${idx}`}
              className="rounded-lg border border-border bg-background p-3 shadow-sm space-y-1"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">{item.title}</p>
                  <p className="text-sm text-muted-foreground">{item.why}</p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p className="font-semibold text-foreground">Due in {item.dueInDays}d</p>
                  <p className="capitalize">Confidence: {item.confidence}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs text-primary">
                <Link href={cmEvidenceLink(brief, item.evidenceArticleIndex)} className="hover:underline">
                  Evidence
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {priorities.length === 0 && fallbackActions.length > 0 && (
        <div className="space-y-2">
          {fallbackActions.map((action, idx) => (
            <div key={`${action}-${idx}`} className="flex items-start gap-2 rounded-md bg-muted/40 px-3 py-2 text-sm">
              <span className="mt-1 h-2 w-2 rounded-full bg-primary" aria-hidden />
              <span className="text-foreground">{action}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
