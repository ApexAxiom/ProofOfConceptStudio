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
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Controls */}
      <div className="flex flex-col gap-2 border-b border-border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-xs">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm"
          />
        </div>
        <button
          onClick={() => setSortOrder(sortOrder === "newest" ? "oldest" : "newest")}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
          </svg>
          {sortOrder === "newest" ? "Newest first" : "Oldest first"}
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/20 text-xs">
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Time</th>
              {showRegion && <th className="px-3 py-2 text-left font-medium text-muted-foreground">Region</th>}
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Category</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground min-w-[200px]">Title</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Signals</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground"></th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSorted.length === 0 ? (
              <tr>
                <td colSpan={showRegion ? 6 : 5} className="px-3 py-8 text-center text-muted-foreground text-sm">
                  No briefs found
                </td>
              </tr>
            ) : (
              filteredAndSorted.map((brief) => {
                const category = categoryForPortfolio(brief.portfolio);
                const meta = CATEGORY_META[category];
                const signals = inferSignals(brief);

                return (
                  <tr key={brief.postId} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                      {formatTimeAgo(brief.publishedAt)}
                    </td>
                    {showRegion && (
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className="text-xs">{brief.region === "au" ? "🇦🇺" : "🇺🇸"}</span>
                      </td>
                    )}
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: meta.color }} />
                        <span className="text-foreground truncate max-w-[120px]" title={portfolioLabel(brief.portfolio)}>
                          {portfolioLabel(brief.portfolio)}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-foreground line-clamp-1" title={brief.title}>{brief.title}</span>
                    </td>
                    <td className="px-3 py-2">
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
                    <td className="px-3 py-2 text-right">
                      <Link
                        href={`/brief/${brief.postId}`}
                        className="text-xs text-primary hover:underline"
                      >
                        View →
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
        <div className="border-t border-border bg-muted/20 px-3 py-2">
          <p className="text-xs text-muted-foreground">
            {filteredAndSorted.length} of {briefs.length} briefs
          </p>
        </div>
      )}
    </div>
  );
}
