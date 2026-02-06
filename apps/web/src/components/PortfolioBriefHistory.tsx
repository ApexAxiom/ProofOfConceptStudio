"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BriefPost, regionLabel } from "@proof/shared";

interface PortfolioBriefHistoryProps {
  briefs: BriefPost[];
}

function regionBadge(brief: BriefPost): string {
  const runWindow = (brief.runWindow ?? "").toLowerCase();
  if (runWindow.includes("apac") || brief.region === "au") return "APAC";
  return "INTL";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

export function PortfolioBriefHistory({ briefs }: PortfolioBriefHistoryProps) {
  const [showAll, setShowAll] = useState(false);
  const sorted = useMemo(
    () => [...briefs].sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()),
    [briefs]
  );
  const visible = showAll ? sorted : sorted.slice(0, 5);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Daily Briefs</h2>
          <p className="text-sm text-muted-foreground">Top 5 latest briefs, with full history on demand.</p>
        </div>
        {sorted.length > 5 ? (
          <button
            type="button"
            onClick={() => setShowAll((value) => !value)}
            className="btn-secondary text-xs"
          >
            {showAll ? "Show less" : `Show all (${sorted.length})`}
          </button>
        ) : null}
      </div>

      <div className="space-y-2">
        {visible.map((brief) => (
          <Link
            key={brief.postId}
            href={`/brief/${brief.postId}`}
            className="block rounded-lg border border-border bg-background p-3 transition hover:border-primary/40"
          >
            <p className="text-sm font-semibold text-foreground line-clamp-1">{brief.title}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded-full border border-border px-2 py-0.5 font-semibold uppercase tracking-[0.1em]">
                {regionBadge(brief)}
              </span>
              <span>{formatDate(brief.publishedAt)}</span>
              <span>{regionLabel(brief.region)}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
