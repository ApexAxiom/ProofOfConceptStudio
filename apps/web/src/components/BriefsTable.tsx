"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { BriefPost, portfolioLabel, regionLabel } from "@proof/shared";
import { categoryForPortfolio, CATEGORY_META } from "@proof/shared";
import { inferSignals } from "../lib/signals";

interface BriefsTableProps {
  briefs: BriefPost[];
  showRegion?: boolean;
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

export function BriefsTable({ briefs, showRegion = true }: BriefsTableProps) {
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
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
      {/* Controls */}
      <div className="flex flex-col gap-3 border-b border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            placeholder="Search briefs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm rounded-lg"
          />
        </div>
        <button
          onClick={() => setSortOrder(sortOrder === "newest" ? "oldest" : "newest")}
          className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
          </svg>
          {sortOrder === "newest" ? "Newest first" : "Oldest first"}
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/20">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Time</th>
              {showRegion && <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Region</th>}
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Category</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground min-w-[250px]">Brief</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Key Data</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Signals</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredAndSorted.length === 0 ? (
              <tr>
                <td colSpan={showRegion ? 7 : 6} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                    <span className="text-sm">No briefs found</span>
                  </div>
                </td>
              </tr>
            ) : (
              filteredAndSorted.map((brief) => {
                const category = categoryForPortfolio(brief.portfolio);
                const meta = CATEGORY_META[category];
                const signals = inferSignals(brief);
                const keyMetrics = brief.selectedArticles?.[0]?.keyMetrics?.slice(0, 2);

                return (
                  <tr key={brief.postId} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground">
                          {formatTimeAgo(brief.publishedAt)}
                        </span>
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
                          {brief.runWindow}
                        </span>
                      </div>
                    </td>
                    {showRegion && (
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm">{brief.region === "au" ? "🇦🇺 AU" : "🇺🇸 US"}</span>
                      </td>
                    )}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span 
                          className="h-2 w-2 rounded-full flex-shrink-0" 
                          style={{ backgroundColor: meta.color }} 
                        />
                        <span className="text-sm text-foreground font-medium truncate max-w-[140px]" title={portfolioLabel(brief.portfolio)}>
                          {portfolioLabel(brief.portfolio)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Link 
                        href={`/brief/${brief.postId}`}
                        className="text-sm font-medium text-foreground hover:text-primary transition-colors line-clamp-2"
                        title={brief.title}
                      >
                        {brief.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {keyMetrics && keyMetrics.length > 0 ? (
                          keyMetrics.map((metric, idx) => (
                            <span 
                              key={idx} 
                              className="inline-flex items-center rounded bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary"
                            >
                              {metric}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {signals.length > 0 ? (
                          signals.slice(0, 2).map((signal) => (
                            <span key={signal.type} className={`${signal.className} text-[10px] px-1.5 py-0.5`}>
                              {signal.label}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/brief/${brief.postId}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                      >
                        Open
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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

      {filteredAndSorted.length > 0 && (
        <div className="border-t border-border bg-muted/20 px-4 py-3">
          <p className="text-xs text-muted-foreground">
            Showing <span className="font-medium text-foreground">{filteredAndSorted.length}</span> of <span className="font-medium text-foreground">{briefs.length}</span> briefs
          </p>
        </div>
      )}
    </div>
  );
}
