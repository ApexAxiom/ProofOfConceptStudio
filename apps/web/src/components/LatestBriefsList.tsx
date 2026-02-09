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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="accent-line" />
          <h2 className="font-display text-lg font-semibold text-foreground">Latest Briefs</h2>
        </div>
        <Link
          href="/au"
          className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors hover-underline"
        >
          View all briefs →
        </Link>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {briefs.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-secondary mx-auto mb-4 flex items-center justify-center">
              <svg className="h-6 w-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <p className="text-sm text-muted-foreground">Coverage refresh in progress</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Check back soon for the latest intelligence</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {briefs.map((brief, index) => {
              const category = categoryForPortfolio(brief.portfolio);
              const meta = CATEGORY_META[category];

              return (
                <li 
                  key={brief.postId}
                  className="reveal-up"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <Link
                    href={`/brief/${encodeURIComponent(brief.postId)}`}
                    className="group flex items-start gap-4 px-5 py-4 hover:bg-secondary/30 transition-all duration-200"
                  >
                    {/* Category indicator */}
                    <div
                      className="mt-2 h-2 w-2 rounded-full flex-shrink-0 transition-transform group-hover:scale-125"
                      style={{ 
                        backgroundColor: meta.color,
                        boxShadow: `0 0 8px ${meta.color}40`
                      }}
                    />
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="font-display text-sm font-semibold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                        {brief.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                        <span className="text-base">{brief.region === "au" ? "🇦🇺" : "🇺🇸"}</span>
                        <span className="truncate max-w-[140px] font-medium">
                          {portfolioLabel(brief.portfolio)}
                        </span>
                        <span className="text-border">•</span>
                        <span className="font-mono">{formatTimeAgo(brief.publishedAt)}</span>
                      <span className="rounded-md bg-secondary border border-border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider">
                          {brief.runWindow.toUpperCase()}
                      </span>
                    </div>
                  </div>
                    
                    {/* Arrow */}
                    <svg
                      className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1 transition-all group-hover:text-primary group-hover:translate-x-1"
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
