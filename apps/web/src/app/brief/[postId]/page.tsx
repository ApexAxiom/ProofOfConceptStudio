import Link from "next/link";
import { RegionTabs } from "../../../components/RegionTabs";
import { FooterSources } from "../../../components/FooterSources";
import { ProxiedImage } from "../../../components/ProxiedImage";
import { fetchPost } from "../../../lib/api";
import { portfolioLabel, regionLabel, REGIONS } from "@proof/shared";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import rehypeExternalLinks from "rehype-external-links";
import { notFound } from "next/navigation";

function getCategoryColor(portfolio: string): string {
  if (portfolio.includes("drill") || portfolio.includes("rig") || portfolio.includes("wells") || portfolio.includes("complet") || portfolio.includes("subsea") || portfolio.includes("project") || portfolio.includes("equipment") || portfolio.includes("decom")) {
    return "energy";
  }
  if (portfolio.includes("logistics") || portfolio.includes("marine") || portfolio.includes("aviation")) {
    return "freight";
  }
  if (portfolio.includes("cyber") || portfolio.includes("it") || portfolio.includes("telecom")) {
    return "cyber";
  }
  if (portfolio.includes("services") || portfolio.includes("hr") || portfolio.includes("professional")) {
    return "services";
  }
  if (portfolio.includes("facility") || portfolio.includes("site")) {
    return "facility";
  }
  if (portfolio.includes("mro") || portfolio.includes("materials")) {
    return "steel";
  }
  return "energy";
}

const badgeClasses: Record<string, string> = {
  energy: "badge-energy",
  steel: "badge-steel",
  freight: "badge-freight",
  services: "badge-services",
  cyber: "badge-cyber",
  facility: "badge-facility"
};

function previewText(markdown?: string, fallback?: string): string {
  if (!markdown) return fallback ?? "";
  const lines = markdown.split(/\r?\n/);
  const firstLine = lines.find((line) => line.trim() && !line.startsWith("#")) ?? fallback ?? "";
  return firstLine.replace(/^\*\*Overview:\*\*\s*/i, "").trim();
}

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
  const sourceUrl = brief.heroImageSourceUrl || brief.sources?.[0];
  const overview = brief.summary ?? previewText(brief.bodyMarkdown, "This brief includes a short overview and quick takes.");
  const categoryColor = getCategoryColor(brief.portfolio);
  const badgeClass = badgeClasses[categoryColor];

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Back Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href={`/${brief.region}`}
          className="group flex items-center gap-2 text-sm font-medium text-slate-400 transition-colors hover:text-white"
        >
          <svg className="h-4 w-4 transition-transform group-hover:-translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Back to {REGIONS[brief.region].city}
        </Link>
        <RegionTabs activeRegion={brief.region} />
      </div>

      {/* Article Card */}
      <article className="overflow-hidden rounded-3xl border border-slate-700/50 bg-gradient-to-br from-slate-900/90 to-slate-950/90 shadow-2xl">
        {/* Hero Image */}
        <div className="relative h-72 w-full overflow-hidden md:h-96">
          <ProxiedImage
            src={brief.heroImageUrl}
            alt={brief.heroImageAlt ?? brief.title}
            className="h-full w-full object-cover"
            loading="eager"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/60 to-transparent" />
          
          {/* Badges */}
          <div className="absolute bottom-6 left-6 flex flex-wrap gap-2">
            <span className={`badge ${badgeClass}`}>
              {portfolioLabel(brief.portfolio)}
            </span>
            <span className="badge bg-slate-800/80 text-slate-300 border border-slate-600/50">
              {regionLabel(brief.region)}
            </span>
            <span className="badge bg-blue-500/20 text-blue-300 border border-blue-500/30">
              {brief.runWindow.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-8 p-6 md:p-10">
          {/* Meta & Actions */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 text-sm text-slate-400">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{publishedStr}</span>
            </div>
            <div className="flex gap-3">
              {sourceUrl && (
                <a
                  href={sourceUrl}
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

          {/* Title & Overview */}
          <div className="space-y-4">
            <h1 className="text-3xl font-bold leading-tight text-white md:text-4xl">{brief.title}</h1>
            <p className="text-lg leading-relaxed text-slate-300">{overview}</p>
          </div>

          <div className="divider" />

          {/* Markdown Body */}
          <div className="prose prose-invert max-w-none prose-headings:text-white prose-h2:text-2xl prose-h2:font-bold prose-h3:text-xl prose-p:text-slate-300 prose-p:leading-relaxed prose-li:text-slate-300 prose-strong:text-white prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline">
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
          <FooterSources sources={brief.sources} />
        </div>
      </article>

      {/* Navigation */}
      <div className="flex items-center justify-between rounded-2xl border border-slate-700/50 bg-slate-900/50 p-6">
        <Link
          href={`/${brief.region}/${brief.portfolio}`}
          className="group flex items-center gap-3 text-sm font-medium text-slate-300 transition-colors hover:text-white"
        >
          <svg className="h-5 w-5 transition-transform group-hover:-translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          <span>More from {portfolioLabel(brief.portfolio)}</span>
        </Link>
        <Link
          href="/"
          className="group flex items-center gap-3 text-sm font-medium text-slate-300 transition-colors hover:text-white"
        >
          <span>Back to Dashboard</span>
          <svg className="h-5 w-5 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
