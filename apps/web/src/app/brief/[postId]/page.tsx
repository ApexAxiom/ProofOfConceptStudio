import Link from "next/link";
import { RegionTabs } from "../../../components/RegionTabs";
import { FooterSources } from "../../../components/FooterSources";
import { ProxiedImage } from "../../../components/ProxiedImage";
import { ArticleList } from "../../../components/ArticleCard";
import { fetchPost } from "../../../lib/api";
import { extractValidUrl } from "../../../lib/url";
import { portfolioLabel, regionLabel, REGIONS } from "@proof/shared";
import { getCategoryBadgeClass, categoryForPortfolio, CATEGORY_META } from "@proof/shared";
import { inferSignals } from "../../../lib/signals";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import rehypeExternalLinks from "rehype-external-links";
import { notFound } from "next/navigation";

function formatPublishDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

function formatPublishTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short"
  });
}

export default async function BriefDetailPage({ params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
  const brief = await fetchPost(postId);
  if (!brief) return notFound();

  const published = new Date(brief.publishedAt);
  const publishedDate = formatPublishDate(brief.publishedAt);
  const publishedTime = formatPublishTime(brief.publishedAt);
  
  const primarySourceUrl = extractValidUrl(brief.heroImageSourceUrl) || 
    extractValidUrl(brief.selectedArticles?.[0]?.url) ||
    extractValidUrl(brief.sources?.[0]);
  
  const sources = (brief.sources ?? [])
    .map((source) => extractValidUrl(source))
    .filter((s): s is string => Boolean(s));
  
  const badgeClass = getCategoryBadgeClass(brief.portfolio);
  const category = categoryForPortfolio(brief.portfolio);
  const categoryMeta = CATEGORY_META[category];
  const heroImageUrl = extractValidUrl(brief.heroImageUrl);
  const selectedArticles = brief.selectedArticles || [];
  const signals = inferSignals(brief);
  const sourceCount = selectedArticles.length || sources.length || 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between">
        <Link
          href={`/${brief.region}`}
          className="group flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <svg className="h-4 w-4 transition-transform group-hover:-translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Back to {REGIONS[brief.region].city}
        </Link>
        <RegionTabs activeRegion={brief.region} />
      </div>

      {/* Executive Brief Header */}
      <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {/* Hero Section */}
        <div className="relative">
          {/* Hero Image with Gradient Overlay */}
          <div className="relative h-48 w-full overflow-hidden bg-muted md:h-64">
            <ProxiedImage
              src={heroImageUrl}
              alt={brief.heroImageAlt ?? brief.title}
              className="h-full w-full object-cover"
              loading="eager"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
            
            {/* Category & Region Pills - Positioned on image */}
            <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <span 
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm"
                  style={{ backgroundColor: `${categoryMeta.color}dd` }}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-white/80" />
                  {portfolioLabel(brief.portfolio)}
                </span>
                <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
                  {regionLabel(brief.region)}
                </span>
                <span className="rounded-full bg-primary/90 px-3 py-1 text-xs font-semibold uppercase text-white">
                  {brief.runWindow.toUpperCase()} Edition
                </span>
              </div>
              
              {/* Title on Hero */}
              <h1 className="text-2xl font-bold leading-tight text-white md:text-3xl lg:text-4xl">
                {brief.title}
              </h1>
            </div>
          </div>
        </div>

        {/* Brief Meta Bar */}
        <div className="border-b border-border bg-muted/30 px-6 py-4 md:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Left: Date & Source Info */}
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
                <span>{publishedDate}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{publishedTime}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z" />
                </svg>
                <span>{sourceCount} sources</span>
              </div>
            </div>
            
            {/* Right: Actions */}
            <div className="flex gap-2">
              {primarySourceUrl && (
                <a
                  href={primarySourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-secondary text-sm"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                  View Primary Source
                </a>
              )}
              <Link
                href="/chat"
                className="btn-primary text-sm"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Ask AI
              </Link>
            </div>
          </div>
        </div>

        {/* Brief Content */}
        <div className="space-y-8 p-6 md:p-8">
          {/* Signals Row */}
          {signals.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {signals.map((signal) => (
                <span key={signal.type} className={`${signal.className} px-3 py-1`}>
                  {signal.label}
                </span>
              ))}
            </div>
          )}
          
          {/* Executive Summary Section */}
          {brief.summary && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-6">
              <div className="flex items-center gap-2 mb-3">
                <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                </svg>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-primary">
                  Executive Summary
                </h2>
              </div>
              <p className="text-base leading-relaxed text-foreground font-medium">
                {brief.summary}
              </p>
            </div>
          )}

          {/* Selected Articles with Enhanced Cards */}
          {selectedArticles.length > 0 && (
            <ArticleList articles={selectedArticles} />
          )}

          {/* Additional Markdown Content */}
          {brief.bodyMarkdown && (
            <>
              <div className="h-px bg-border" />
              <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:text-foreground prose-p:text-muted-foreground prose-strong:text-foreground prose-a:text-primary">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[
                    rehypeSanitize,
                    [rehypeExternalLinks, { target: "_blank", rel: ["noreferrer", "noopener"] }]
                  ]}
                >
                  {brief.bodyMarkdown}
                </ReactMarkdown>
              </div>
            </>
          )}

          {/* Sources Footer */}
          {sources.length > 0 && (
            <>
              <div className="h-px bg-border" />
              <FooterSources sources={sources} />
            </>
          )}
        </div>
      </article>

      {/* Bottom Navigation */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
        <Link
          href={`/${brief.region}/${brief.portfolio}`}
          className="group flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <svg className="h-4 w-4 transition-transform group-hover:-translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          <span>More from {portfolioLabel(brief.portfolio)}</span>
        </Link>
        <Link
          href="/"
          className="group flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <span>Back to Dashboard</span>
          <svg className="h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
