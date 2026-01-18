import Link from "next/link";
import { BriefPost, portfolioLabel, regionLabel } from "@proof/shared";
import { categoryForPortfolio, getCategoryBadgeClass, CATEGORY_META } from "@proof/shared";
import { ProxiedImage } from "./ProxiedImage";
import { extractValidUrl } from "../lib/url";
import { inferSignals } from "../lib/signals";

function previewText(brief: BriefPost): string {
  if (brief.summary) return brief.summary;
  const lines = brief.bodyMarkdown?.split(/\r?\n/) ?? [];
  const firstLine = lines.find((line) => line.trim() && !line.startsWith("#")) ?? "";
  return firstLine.replace(/^\*\*Overview:\*\*\s*/i, "").trim();
}

function truncate(text: string, max = 120): string {
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
    <span className="text-xs font-mono text-muted-foreground">
      {timeStr}
    </span>
  );
}

export function BriefCard({ brief }: { brief: BriefPost }) {
  const summary = truncate(previewText(brief) || brief.title);
  const primaryArticleUrl = 
    extractValidUrl(brief.heroImageSourceUrl) ??
    extractValidUrl(brief.selectedArticles?.[0]?.url) ??
    extractValidUrl(brief.sources?.[0]);
  const category = categoryForPortfolio(brief.portfolio);
  const categoryMeta = CATEGORY_META[category];
  const heroImageAlt = brief.heroImageAlt?.trim() || brief.title;
  const heroImageUrl = extractValidUrl(brief.heroImageUrl);
  const signals = inferSignals(brief);
  const sourceCount = brief.selectedArticles?.length || brief.sources?.length || 0;

  // Get first article's key metrics if available
  const keyMetrics = brief.selectedArticles?.[0]?.keyMetrics?.slice(0, 2);

  return (
    <article 
      className="group relative flex flex-col overflow-hidden rounded-lg border border-border bg-card transition-all duration-300 hover:border-primary/40"
      style={{
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.12)"
      }}
    >
      {/* Hero Image with Premium Overlay */}
      <div className="relative h-40 w-full overflow-hidden bg-secondary">
        <ProxiedImage
          src={heroImageUrl}
          alt={heroImageAlt}
          className="h-full w-full object-cover transition-all duration-500 group-hover:scale-105"
          loading="lazy"
          style={{ filter: "brightness(0.9)" }}
        />
        
        {/* Multi-layer gradient for depth */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-black/20" />
        
        {/* Edition Badge - Top right */}
        <div className="absolute right-3 top-3">
          <span className="rounded-md bg-black/60 backdrop-blur-sm px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.15em] text-white border border-white/10">
            {brief.runWindow.toUpperCase()}
          </span>
        </div>
        
        {/* Category Badge - Bottom left on image */}
        <div className="absolute bottom-3 left-3">
          <span 
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur-sm border border-white/10"
            style={{ backgroundColor: `${categoryMeta.color}cc` }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-white/90 shadow-[0_0_4px_rgba(255,255,255,0.6)]" />
            {portfolioLabel(brief.portfolio)}
          </span>
        </div>
      </div>
      
      {/* Content */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        {/* Meta Row */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <TimeAgo date={brief.publishedAt} />
            <span className="text-border">•</span>
            <span className="text-muted-foreground">{regionLabel(brief.region)}</span>
          </div>
          <span className="font-mono text-muted-foreground">{sourceCount} src</span>
        </div>
        
        {/* Title - Editorial serif */}
        <h3 className="font-display text-base font-semibold leading-snug text-foreground line-clamp-2 group-hover:text-primary transition-colors">
          {brief.title}
        </h3>
        
        {/* Key Metrics Strip */}
        {keyMetrics && keyMetrics.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {keyMetrics.map((metric, idx) => (
              <span 
                key={idx} 
                className="inline-flex items-center rounded-md bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-semibold text-primary"
              >
                {metric}
              </span>
            ))}
          </div>
        )}
        
        {/* Signals */}
        {signals.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {signals.slice(0, 2).map((signal) => (
              <span key={signal.type} className={`signal-chip text-[10px]`}>
                {signal.label}
              </span>
            ))}
          </div>
        )}
        
        {/* Summary */}
        <p className="text-xs leading-relaxed text-muted-foreground line-clamp-2 flex-1">
          {summary}
        </p>
        
        {/* Actions - Premium styling */}
        <div className="flex items-center gap-2 pt-3 border-t border-border mt-auto">
          <Link
            href={`/brief/${brief.postId}`}
            className="btn-primary flex-1 justify-center py-2 text-xs"
          >
            Read Brief
          </Link>
          {primaryArticleUrl && (
            <a
              href={primaryArticleUrl}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary px-3 py-2 group/icon"
              title="View primary source"
            >
              <svg className="h-4 w-4 transition-transform group-hover/icon:translate-x-0.5 group-hover/icon:-translate-y-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            </a>
          )}
        </div>
      </div>
      
      {/* Hover glow effect */}
      <div 
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{
          background: `radial-gradient(600px circle at 50% 0%, ${categoryMeta.color}08, transparent 40%)`
        }}
      />
    </article>
  );
}
