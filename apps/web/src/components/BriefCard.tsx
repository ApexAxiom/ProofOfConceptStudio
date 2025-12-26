import Link from "next/link";
import { BriefPost, portfolioLabel, regionLabel } from "@proof/shared";
import { categoryForPortfolio, getCategoryBadgeClass } from "@proof/shared";
import { ProxiedImage } from "./ProxiedImage";
import { extractValidUrl } from "../lib/url";
import { inferSignals } from "../lib/signals";

function previewText(brief: BriefPost): string {
  if (brief.summary) return brief.summary;
  const lines = brief.bodyMarkdown?.split(/\r?\n/) ?? [];
  const firstLine = lines.find((line) => line.trim() && !line.startsWith("#")) ?? "";
  return firstLine.replace(/^\*\*Overview:\*\*\s*/i, "").trim();
}

function truncate(text: string, max = 150): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max).trim()}…`;
}

function TimeAgo({ date }: { date: string }) {
  const now = new Date();
  const published = new Date(date);
  const diffMs = now.getTime() - published.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  
  let timeStr: string;
  if (diffHours < 1) {
    timeStr = "Just now";
  } else if (diffHours < 24) {
    timeStr = `${diffHours}h ago`;
  } else if (diffDays === 1) {
    timeStr = "Yesterday";
  } else if (diffDays < 7) {
    timeStr = `${diffDays}d ago`;
  } else {
    timeStr = published.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      {timeStr}
    </span>
  );
}

export function BriefCard({ brief }: { brief: BriefPost }) {
  const summary = truncate(previewText(brief) || brief.title);
  const primaryArticleUrl = 
    extractValidUrl(brief.selectedArticles?.[0]?.url) ??
    extractValidUrl(brief.heroImageSourceUrl) ?? 
    extractValidUrl(brief.sources?.[0]);
  const badgeClass = getCategoryBadgeClass(brief.portfolio);
  const heroImageAlt = brief.heroImageAlt?.trim() || brief.title;
  const heroImageUrl = extractValidUrl(brief.heroImageUrl);
  const signals = inferSignals(brief);
  const sourceCount = brief.selectedArticles?.length || brief.sources?.length || 0;

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all duration-200 hover:shadow-md hover:border-border/80">
      {/* Hero Image */}
      <div className="relative h-40 w-full overflow-hidden bg-muted">
        <ProxiedImage
          src={heroImageUrl}
          alt={heroImageAlt}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
        
        {/* Run window badge */}
        <div className="absolute right-2 top-2">
          <span className="rounded-md bg-background/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-foreground backdrop-blur-sm">
            {brief.runWindow}
          </span>
        </div>
        
        {/* Bottom tags */}
        <div className="absolute bottom-2 left-2 flex flex-wrap gap-1.5">
          <span className={`badge ${badgeClass}`}>
            {portfolioLabel(brief.portfolio)}
          </span>
          <span className="badge badge-neutral">
            {regionLabel(brief.region)}
          </span>
        </div>
      </div>
      
      {/* Content */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between">
            <TimeAgo date={brief.publishedAt} />
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">{sourceCount} sources</span>
            </div>
          </div>
          
          <h3 className="text-base font-semibold leading-snug text-foreground line-clamp-2 group-hover:text-primary transition-colors">
            {brief.title}
          </h3>
          
          {/* Signals */}
          {signals.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {signals.map((signal) => (
                <span key={signal.type} className={signal.className}>
                  {signal.label}
                </span>
              ))}
            </div>
          )}
          
          <p className="text-sm leading-relaxed text-muted-foreground line-clamp-2">
            {summary}
          </p>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t border-border">
          <Link
            href={`/brief/${brief.postId}`}
            className="btn-primary flex-1 justify-center py-2 text-sm"
          >
            Open Brief
          </Link>
          {primaryArticleUrl && (
            <a
              href={primaryArticleUrl}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary px-3 py-2"
              title="View original article"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
