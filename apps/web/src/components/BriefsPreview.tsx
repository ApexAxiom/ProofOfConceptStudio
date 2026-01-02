import Link from "next/link";
import { BriefPost, RegionSlug } from "@proof/shared";

interface BriefsPreviewProps {
  briefs: BriefPost[];
  region: RegionSlug;
  portfolio: string;
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

export function BriefsPreview({ briefs, region, portfolio }: BriefsPreviewProps) {
  const topBriefs = briefs.slice(0, 3);

  if (topBriefs.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
          <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          <span>Latest Briefs</span>
        </div>
        <p className="text-sm text-muted-foreground">
          No briefs yet. Briefs will appear here once runs complete.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          <span>Latest Briefs</span>
        </div>
        <Link
          href={`/${region}/${portfolio}?tab=briefs`}
          className="text-xs font-medium text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
        >
          View all briefs
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </Link>
      </div>

      <div className="space-y-2">
        {topBriefs.map((brief) => (
          <Link
            key={brief.postId}
            href={`/brief/${brief.postId}`}
            className="flex items-start gap-3 rounded-md bg-background border border-border p-3 hover:border-primary/30 hover:bg-secondary/30 transition-all group"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                {brief.title}
              </p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-xs font-mono text-muted-foreground">
                  {formatTimeAgo(brief.publishedAt)}
                </span>
                <span className="rounded-md bg-secondary border border-border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                  {brief.runWindow.toUpperCase()}
                </span>
              </div>
            </div>
            <svg className="h-4 w-4 text-muted-foreground group-hover:text-primary flex-shrink-0 mt-0.5 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </Link>
        ))}
      </div>

      {briefs.length > 3 && (
        <p className="text-xs text-muted-foreground text-center pt-1">
          +{briefs.length - 3} more briefs
        </p>
      )}
    </div>
  );
}
