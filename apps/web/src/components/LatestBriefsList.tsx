import Link from "next/link";
import { BriefPost, portfolioLabel } from "@proof/shared";
import { categoryForPortfolio, CATEGORY_META } from "@proof/shared";

interface LatestBriefsListProps {
  briefs: BriefPost[];
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

export function LatestBriefsList({ briefs }: LatestBriefsListProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Latest Briefs</h2>
        <Link
          href="/au"
          className="text-xs font-medium text-primary hover:underline"
        >
          View all →
        </Link>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {briefs.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No briefs available
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {briefs.map((brief) => {
              const category = categoryForPortfolio(brief.portfolio);
              const meta = CATEGORY_META[category];

              return (
                <li key={brief.postId}>
                  <Link
                    href={`/brief/${brief.postId}`}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
                  >
                    <div
                      className="mt-1.5 h-2 w-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: meta.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground line-clamp-1">
                        {brief.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span>{brief.region === "au" ? "🇦🇺" : "🇺🇸"}</span>
                        <span className="truncate max-w-[120px]">
                          {portfolioLabel(brief.portfolio)}
                        </span>
                        <span>•</span>
                        <span>{formatTimeAgo(brief.publishedAt)}</span>
                        <span className="rounded bg-muted px-1 py-0.5 text-[10px] font-bold uppercase">
                          {brief.runWindow}
                        </span>
                      </div>
                    </div>
                    <svg
                      className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M8.25 4.5l7.5 7.5-7.5 7.5"
                      />
                    </svg>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
