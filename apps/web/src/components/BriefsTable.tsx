"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { BriefPost, portfolioLabel } from "@proof/shared";
import { inferSignals } from "../lib/signals";

interface BriefsTableProps {
  briefs: BriefPost[];
  showRegion?: boolean;
  variant?: "full" | "history";
}

function formatTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffHours < 1) return "Just now";
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatCompactDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${date} · ${time}`;
}

function regionBadge(brief: BriefPost): string {
  // Prefer runWindow if present (APAC / INTL), fallback to region slug
  const rw = (brief.runWindow || "").toLowerCase();
  if (rw.includes("apac") || brief.region === "au") return "🌏 APAC";
  return "🌎 INTL";
}

/**
 * Renders a filtered and sortable briefs table.
 */
export function BriefsTable({ briefs, showRegion = true, variant = "full" }: BriefsTableProps) {
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");

  const filteredAndSorted = useMemo(() => {
    let result = [...briefs];

    if (search.trim()) {
      const query = search.toLowerCase();
      result = result.filter((brief) => {
        const signals = inferSignals(brief);
        const signalText = signals.map(s => s.label).join(" ").toLowerCase();
        return (
          brief.title.toLowerCase().includes(query) ||
          portfolioLabel(brief.portfolio).toLowerCase().includes(query) ||
          signalText.includes(query) ||
          (brief.tags || []).some(tag => tag.toLowerCase().includes(query))
        );
      });
    }

    result.sort((a, b) => {
      const comparison = new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime();
      return sortOrder === "newest" ? -comparison : comparison;
    });

    return result;
  }, [briefs, search, sortOrder]);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Controls - Premium styling */}
      <div className={`flex flex-col gap-3 border-b border-border bg-secondary/30 ${variant === "history" ? "p-3" : "p-4"} sm:flex-row sm:items-center sm:justify-between`}>
        <div className="relative flex-1 max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            placeholder="Search briefs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm rounded-md bg-background"
          />
        </div>
        <button
          onClick={() => setSortOrder(sortOrder === "newest" ? "oldest" : "newest")}
          className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-secondary"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
          </svg>
          <span className={variant === "history" ? "hidden sm:inline" : ""}>
            {sortOrder === "newest" ? "Newest first" : "Oldest first"}
          </span>
        </button>
      </div>

      {variant === "history" ? (
        <>
          {/* Mobile list */}
          <div className="sm:hidden">
            {filteredAndSorted.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">No briefs found</div>
            ) : (
              <ul className="divide-y divide-border/50">
                {filteredAndSorted.map((brief) => (
                  <li key={brief.postId} className="px-4 py-3">
                    <div className="flex items-start gap-3">
                      <div className="shrink-0">
                        <div className="text-[11px] font-mono text-muted-foreground whitespace-nowrap">
                          {formatCompactDateTime(brief.publishedAt)}
                        </div>
                        {showRegion && (
                          <div className="mt-1 inline-flex items-center rounded-md bg-secondary border border-border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            {regionBadge(brief)}
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/brief/${encodeURIComponent(brief.postId)}`}
                          className="text-sm font-medium text-foreground hover:text-primary transition-colors line-clamp-2"
                          title={brief.title}
                        >
                          {brief.title}
                        </Link>
                      </div>

                      <Link
                        href={`/brief/${encodeURIComponent(brief.postId)}`}
                        className="btn-ghost text-xs py-1.5 px-2 shrink-0"
                      >
                        Open
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/20">
                  <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Date</th>
                  {showRegion && <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Region</th>}
                  <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Brief</th>
                  <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredAndSorted.length === 0 ? (
                  <tr>
                    <td colSpan={showRegion ? 4 : 3} className="px-4 py-10 text-center text-sm text-muted-foreground">No briefs found</td>
                  </tr>
                ) : (
                  filteredAndSorted.map((brief) => (
                    <tr key={brief.postId} className="group hover:bg-secondary/20 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-xs font-mono text-muted-foreground">
                          {formatCompactDateTime(brief.publishedAt)}
                        </span>
                      </td>
                      {showRegion && (
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="inline-flex items-center rounded-md bg-secondary border border-border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            {regionBadge(brief)}
                          </span>
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <Link
                          href={`/brief/${encodeURIComponent(brief.postId)}`}
                          className="font-display text-sm font-medium text-foreground hover:text-primary transition-colors line-clamp-1"
                          title={brief.title}
                        >
                          {brief.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/brief/${encodeURIComponent(brief.postId)}`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors">
                          Open
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                          </svg>
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        /* Full table - existing layout */
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/20">
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Time</th>
                {showRegion && <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Region</th>}
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground min-w-[250px]">Brief</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Signals</th>
                <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filteredAndSorted.length === 0 ? (
                <tr>
                  <td colSpan={showRegion ? 5 : 4} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
                        <svg className="h-6 w-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                      </div>
                      <span className="text-sm text-muted-foreground">No briefs found</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredAndSorted.map((brief) => {
                  const signals = inferSignals(brief);

                  return (
                    <tr key={brief.postId} className="group hover:bg-secondary/20 transition-colors">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-muted-foreground">
                            {formatTimeAgo(brief.publishedAt)}
                          </span>
                          <span className="rounded-md bg-secondary border border-border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                            {brief.runWindow.toUpperCase()}
                          </span>
                        </div>
                      </td>
                      {showRegion && (
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className="text-sm">{brief.region === "au" ? "🇦🇺 AU" : "🇺🇸 US"}</span>
                        </td>
                      )}
                      <td className="px-4 py-4">
                        <Link 
                          href={`/brief/${encodeURIComponent(brief.postId)}`}
                          className="font-display text-sm font-medium text-foreground hover:text-primary transition-colors line-clamp-2"
                          title={brief.title}
                        >
                          {brief.title}
                        </Link>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-1.5">
                          {signals.length > 0 ? (
                            signals.slice(0, 2).map((signal) => (
                              <span key={signal.type} className="signal-chip text-[10px]">
                                {signal.label}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <Link
                          href={`/brief/${encodeURIComponent(brief.postId)}`}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors group/link"
                        >
                          Open
                          <svg className="h-3 w-3 transition-transform group-hover/link:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                          </svg>
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {filteredAndSorted.length > 0 && (
        <div className="border-t border-border bg-secondary/20 px-4 py-3">
          <p className="text-xs text-muted-foreground">
            Showing <span className="font-semibold text-foreground">{filteredAndSorted.length}</span> of <span className="font-semibold text-foreground">{briefs.length}</span> briefs
          </p>
        </div>
      )}
    </div>
  );
}
