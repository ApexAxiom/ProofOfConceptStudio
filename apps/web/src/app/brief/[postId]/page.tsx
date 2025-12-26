import Link from "next/link";
import { RegionTabs } from "../../../components/RegionTabs";
import { FooterSources } from "../../../components/FooterSources";
import { ProxiedImage } from "../../../components/ProxiedImage";
import { ArticleList } from "../../../components/ArticleCard";
import { fetchPost } from "../../../lib/api";
import { extractValidUrl } from "../../../lib/url";
import { portfolioLabel, regionLabel, REGIONS } from "@proof/shared";
import { getCategoryBadgeClass } from "@proof/shared";
import { inferSignals } from "../../../lib/signals";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import rehypeExternalLinks from "rehype-external-links";
import { notFound } from "next/navigation";

export default async function BriefDetailPage({ params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
  const brief = await fetchPost(postId);
  if (!brief) return notFound();

  const published = new Date(brief.publishedAt);
  const publishedStr = published.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
  
  const primarySourceUrl = extractValidUrl(brief.heroImageSourceUrl) || 
    extractValidUrl(brief.selectedArticles?.[0]?.url) ||
    extractValidUrl(brief.sources?.[0]);
  
  const sources = (brief.sources ?? [])
    .map((source) => extractValidUrl(source))
    .filter((s): s is string => Boolean(s));
  
  const overview = brief.summary || "This brief includes a short overview and quick takes.";
  const badgeClass = getCategoryBadgeClass(brief.portfolio);
  const heroImageUrl = extractValidUrl(brief.heroImageUrl);
  const selectedArticles = brief.selectedArticles || [];
  const signals = inferSignals(brief);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Back Navigation */}
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

      {/* Article Card */}
      <article className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {/* Hero Image */}
        <div className="relative h-56 w-full overflow-hidden bg-muted md:h-72">
          <ProxiedImage
            src={heroImageUrl}
            alt={brief.heroImageAlt ?? brief.title}
            className="h-full w-full object-cover"
            loading="eager"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          
          {/* Badges */}
          <div className="absolute bottom-4 left-4 flex flex-wrap gap-2">
            <span className={`badge ${badgeClass}`}>
              {portfolioLabel(brief.portfolio)}
            </span>
            <span className="badge bg-white/90 text-slate-700 dark:bg-slate-800/90 dark:text-slate-200">
              {regionLabel(brief.region)}
            </span>
            <span className="badge bg-primary/90 text-white">
              {brief.runWindow.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-6 p-5 md:p-8">
          {/* Meta & Actions */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{publishedStr}</span>
            </div>
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
                  View Source
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

          {/* Title & Signals */}
          <div className="space-y-3">
            <h1 className="text-2xl font-bold leading-tight text-foreground md:text-3xl">{brief.title}</h1>
            
            {signals.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {signals.map((signal) => (
                  <span key={signal.type} className={signal.className}>
                    {signal.label}
                  </span>
                ))}
              </div>
            )}
            
            <p className="text-base leading-relaxed text-muted-foreground">{overview}</p>
          </div>

          <div className="divider" />

          {/* Selected Articles with Direct Links */}
          {selectedArticles.length > 0 && (
            <>
              <ArticleList articles={selectedArticles} />
              <div className="divider" />
            </>
          )}

          {/* Markdown Body */}
          <div className="prose max-w-none dark:prose-invert">
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

          <div className="divider" />

          {/* Sources */}
          <FooterSources sources={sources} />
        </div>
      </article>

      {/* Navigation */}
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
