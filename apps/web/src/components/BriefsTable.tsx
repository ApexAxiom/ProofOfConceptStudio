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

function SearchIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  );
}

function ArrowUpDown() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
    </svg>
  );
}

export function BriefsTable({ briefs, showRegion = true }: BriefsTableProps) {
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [runWindowFilter, setRunWindowFilter] = useState<"all" | "am" | "pm">("all");

  const filteredAndSorted = useMemo(() => {
    let result = [...briefs];

    // Filter by search
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

    // Filter by run window
    if (runWindowFilter !== "all") {
      result = result.filter((brief) => brief.runWindow === runWindowFilter);
    }

    // Sort
    result.sort((a, b) => {
      const comparison = new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime();
      return sortOrder === "newest" ? -comparison : comparison;
    });

    return result;
  }, [briefs, search, sortOrder, runWindowFilter]);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Table Controls */}
      <div className="flex flex-col gap-3 border-b border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            <SearchIcon />
          </span>
          <input
            type="text"
            placeholder="Search briefs, portfolios, signals..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={runWindowFilter}
            onChange={(e) => setRunWindowFilter(e.target.value as "all" | "am" | "pm")}
            className="text-sm py-2 px-3"
          >
            <option value="all">All Windows</option>
            <option value="am">AM Only</option>
            <option value="pm">PM Only</option>
          </select>
          <button
            onClick={() => setSortOrder(sortOrder === "newest" ? "oldest" : "newest")}
            className="btn-ghost flex items-center gap-1.5 py-2 px-3 text-sm"
          >
            <ArrowUpDown />
            {sortOrder === "newest" ? "Newest" : "Oldest"}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/20">
              <th className="px-4 py-3 text-left">Published</th>
              {showRegion && <th className="px-4 py-3 text-left">Region</th>}
              <th className="px-4 py-3 text-left">Portfolio</th>
              <th className="px-4 py-3 text-left min-w-[200px]">Title</th>
              <th className="px-4 py-3 text-left">Signals</th>
              <th className="px-4 py-3 text-center">Sources</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSorted.length === 0 ? (
              <tr>
                <td colSpan={showRegion ? 7 : 6} className="px-4 py-12 text-center text-muted-foreground">
                  No briefs found matching your criteria
                </td>
              </tr>
            ) : (
              filteredAndSorted.map((brief) => {
                const category = categoryForPortfolio(brief.portfolio);
                const meta = CATEGORY_META[category];
                const signals = inferSignals(brief);
                const sourceCount = brief.selectedArticles?.length || brief.sources?.length || 0;

                return (
                  <tr key={brief.postId} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-foreground">
                          {formatTimeAgo(brief.publishedAt)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(brief.publishedAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit"
                          })}
                        </span>
                      </div>
                    </td>
                    {showRegion && (
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="badge badge-neutral">
                          {brief.region === "au" ? "🇦🇺" : "🇺🇸"} {regionLabel(brief.region).split(" ")[0]}
                        </span>
                      </td>
                    )}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: meta.color }}
                        />
                        <span className="text-sm font-medium text-foreground truncate max-w-[150px]" title={portfolioLabel(brief.portfolio)}>
                          {portfolioLabel(brief.portfolio)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-foreground line-clamp-1" title={brief.title}>
                        {brief.title}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {signals.length > 0 ? (
                          signals.map((signal) => (
                            <span key={signal.type} className={signal.className}>
                              {signal.label}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center h-6 min-w-[24px] rounded-full bg-muted text-xs font-medium text-muted-foreground">
                        {sourceCount}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/brief/${brief.postId}`}
                        className="btn-primary py-1.5 px-3 text-xs"
                      >
                        Open Brief
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      {filteredAndSorted.length > 0 && (
        <div className="border-t border-border bg-muted/20 px-4 py-2.5">
          <p className="text-xs text-muted-foreground">
            Showing {filteredAndSorted.length} of {briefs.length} briefs
          </p>
        </div>
      )}
    </div>
  );
}
