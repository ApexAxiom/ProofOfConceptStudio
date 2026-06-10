"use client";

import Link from "next/link";
import { useState } from "react";
import type { BriefSignalLevel } from "@proof/shared";
import { SignalBadge } from "./SignalBadge";

export interface CategoryDayRow {
  portfolio: string;
  portfolioLabel: string;
  postId: string;
  title: string;
  publishedAt: string;
  signalLevel?: BriefSignalLevel;
}

interface RegionBoard {
  region: string;
  regionLabel: string;
  rows: CategoryDayRow[];
}

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * "My categories today": one row per category with its triage badge and the
 * latest brief headline. This is the primary daily entry point — a category
 * manager should be able to triage their whole portfolio in one glance.
 */
export function CategoryDayBoard({ boards }: { boards: RegionBoard[] }) {
  const [activeRegion, setActiveRegion] = useState(boards[0]?.region ?? "");
  const active = boards.find((board) => board.region === activeRegion) ?? boards[0];
  if (!active) return null;

  const actCount = active.rows.filter((row) => row.signalLevel === "act").length;
  const watchCount = active.rows.filter((row) => row.signalLevel === "watch").length;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {boards.map((board) => (
            <button
              key={board.region}
              type="button"
              onClick={() => setActiveRegion(board.region)}
              className={`rounded-full border px-3 py-1 text-sm transition ${
                board.region === active.region
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/30"
              }`}
            >
              {board.regionLabel}
            </button>
          ))}
        </div>
        {actCount + watchCount > 0 ? (
          <p className="text-xs text-muted-foreground">
            {actCount > 0 ? `${actCount} need${actCount === 1 ? "s" : ""} action` : ""}
            {actCount > 0 && watchCount > 0 ? " · " : ""}
            {watchCount > 0 ? `${watchCount} worth watching` : ""}
          </p>
        ) : null}
      </div>

      <ul className="mt-4 divide-y divide-border">
        {active.rows.map((row) => (
          <li key={`${active.region}-${row.portfolio}`}>
            <Link
              href={`/brief/${encodeURIComponent(row.postId)}`}
              className="flex items-center gap-3 px-2 py-2.5 transition hover:bg-secondary/40"
            >
              <span className="w-44 shrink-0 truncate text-sm font-medium text-foreground md:w-56">
                {row.portfolioLabel}
              </span>
              <span className="w-20 shrink-0">
                <SignalBadge level={row.signalLevel} />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{row.title}</span>
              <span className="hidden shrink-0 text-xs font-mono text-muted-foreground sm:block">
                {formatDay(row.publishedAt)}
              </span>
            </Link>
          </li>
        ))}
        {active.rows.length === 0 ? (
          <li className="px-2 py-4 text-sm text-muted-foreground">
            No briefs published for this region yet. They appear after the next category run.
          </li>
        ) : null}
      </ul>
    </div>
  );
}
