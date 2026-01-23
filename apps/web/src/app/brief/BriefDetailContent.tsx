import Link from "next/link";
import ReactMarkdown from "react-markdown";
import rehypeExternalLinks from "rehype-external-links";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { FooterSources } from "../../components/FooterSources";
import { ArticleList } from "../../components/ArticleCard";
import { ProxiedImage } from "../../components/ProxiedImage";
import { RegionTabs } from "../../components/RegionTabs";
import { CopyActionsButton } from "../../components/CopyActionsButton";
import { BriefClaims } from "../../components/BriefClaims";
import { MarketSnapshotTiles } from "../../components/MarketSnapshotTiles";
import { CmSnapshotPanel } from "../../components/cm/CmSnapshotPanel";
import { VpSnapshotPanel } from "../../components/vp/VpSnapshotPanel";
import { inferSignals } from "../../lib/signals";
import { extractValidUrl } from "../../lib/url";
import {
  BriefPost,
  CATEGORY_META,
  REGIONS,
  buildSourceId,
  categoryForPortfolio,
  normalizeBriefSources,
  portfolioLabel,
  regionLabel
} from "@proof/shared";

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

/**
 * Displays a detailed intelligence brief with navigation and region switching controls.
 */
export function BriefDetailContent({ brief }: { brief: BriefPost }) {
  const published = new Date(brief.publishedAt);
  const publishedDate = formatPublishDate(brief.publishedAt);
  const publishedTime = formatPublishTime(brief.publishedAt);

  const normalizedSources = normalizeBriefSources(brief.sources);
  const hasEvidence = Array.isArray(brief.claims) && brief.claims.length > 0;
  const allowedSourceIds = new Set(normalizedSources.map((source) => source.sourceId));

  const sources = hasEvidence
    ? normalizedSources
        .map((source) => extractValidUrl(source.url))
        .filter((s): s is string => Boolean(s))
    : [];

  const category = categoryForPortfolio(brief.portfolio);
  const categoryMeta = CATEGORY_META[category];
  const heroImageUrl = extractValidUrl(brief.heroImageUrl);
  const selectedArticles =
    allowedSourceIds.size === 0
      ? brief.selectedArticles || []
      : (brief.selectedArticles || []).filter((article) => {
          const sourceId = article.sourceId ?? (article.url ? buildSourceId(article.url) : "");
          return sourceId ? allowedSourceIds.has(sourceId) : true;
        });
  const pickAllowed = (url?: string) => {
    const valid = extractValidUrl(url);
    if (!valid || allowedSourceIds.size === 0) return valid;
    return allowedSourceIds.has(buildSourceId(valid)) ? valid : undefined;
  };
  const primarySourceUrl = hasEvidence
    ? pickAllowed(brief.heroImageSourceUrl) ||
      pickAllowed(selectedArticles[0]?.url) ||
      extractValidUrl(normalizedSources[0]?.url)
    : undefined;
  const signals = inferSignals(brief);
  const sourceCount = hasEvidence ? sources.length : 0;
  const keyData = Array.from(
    new Set(selectedArticles.flatMap((article) => article.keyMetrics ?? []))
  ).slice(0, 3);
  const decisionSummary = brief.decisionSummary;
  const doNextActions = [
    ...(decisionSummary?.doNext ?? []),
    ...(decisionSummary?.doNext?.length ? [] : (brief.procurementActions ?? [])),
    ...(decisionSummary?.doNext?.length
      ? []
      : (brief.vpSnapshot?.recommendedActions ?? []).map(
          (action) => `${action.action} (${action.ownerRole}, ${action.dueInDays}d)`
        ))
  ].filter(Boolean);
  const whatChanged = decisionSummary?.whatChanged?.length
    ? decisionSummary.whatChanged
    : brief.deltaSinceLastRun ?? [];
  const watchThisWeek = decisionSummary?.watchThisWeek?.length
    ? decisionSummary.watchThisWeek
    : brief.watchlist ?? [];
  const evidenceStats = (brief.claims ?? []).reduce(
    (acc, claim) => {
      if (claim.status === "supported") acc.supported += 1;
      if (claim.status === "analysis") acc.analysis += 1;
      return acc;
    },
    { supported: 0, analysis: 0 }
  );

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Top Navigation Bar */}
      <div className="flex flex-col gap-3">
        <Link
          href={`/${brief.region}`}
          className="group inline-flex w-fit items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
        >
          <svg className="h-4 w-4 transition-transform group-hover:-translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Back to {REGIONS[brief.region].city}
        </Link>
        <RegionTabs activeRegion={brief.region} />
      </div>

      {/* Executive Brief Header - Premium styling */}
      <article className="overflow-hidden rounded-xl border border-border bg-card">
        {/* Brief Summary Bar */}
        <div className="brief-summary-bar">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                {portfolioLabel(brief.portfolio)} • {regionLabel(brief.region)}
              </p>
              <p className="text-sm font-semibold text-foreground">Daily Brief</p>
              <p className="text-xs text-muted-foreground mt-1">
                Published {publishedDate} · {publishedTime}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {signals.map((signal) => (
                <span key={signal.type} className="signal-chip text-[10px]">
                  {signal.label}
                </span>
              ))}
              {keyData.map((metric) => (
                <span key={metric} className="inline-flex items-center rounded-md bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  {metric}
                </span>
              ))}
              {primarySourceUrl && (
                <a
                  href={primarySourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-secondary text-sm"
                >
                  Open primary source
                </a>
              )}
              <CopyActionsButton actions={brief.procurementActions ?? []} />
            </div>
          </div>
        </div>
        {/* Hero Section */}
        <div className="relative">
          {/* Hero Image with Premium Gradient Overlay */}
          <div className="relative h-56 w-full overflow-hidden bg-secondary md:h-72">
            <ProxiedImage
              src={heroImageUrl}
              alt={brief.heroImageAlt ?? brief.title}
              className="h-full w-full object-cover"
              loading="eager"
              style={{ filter: "brightness(0.85)" }}
            />
            {/* Multi-layer gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-black/30" />

            {/* Category & Region Pills - Positioned on image */}
            <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm border border-white/10"
                  style={{ backgroundColor: `${categoryMeta.color}cc` }}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-white/90 shadow-[0_0_4px_rgba(255,255,255,0.6)]" />
                  {portfolioLabel(brief.portfolio)}
                </span>
                <span className="rounded-full bg-white/10 border border-white/10 backdrop-blur-sm px-3 py-1.5 text-xs font-medium text-white">
                  {regionLabel(brief.region)}
                </span>
                <span className="rounded-full bg-primary/90 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-primary-foreground">
                  {brief.runWindow.toUpperCase()} Edition
                </span>
              </div>

              {/* Title on Hero - Editorial serif */}
              <h1 className="font-display text-2xl font-bold leading-tight text-white md:text-3xl lg:text-4xl tracking-tight">
                {brief.title}
              </h1>
            </div>
          </div>
        </div>

        {/* Brief Meta Bar - Premium styling */}
        <div className="border-b border-border bg-secondary/30 px-6 py-4 md:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Left: Date & Source Info */}
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <svg className="h-4 w-4 text-primary/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
                <span>{publishedDate}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <svg className="h-4 w-4 text-primary/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-mono">{publishedTime}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <svg className="h-4 w-4 text-primary/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z" />
                </svg>
                <span className="font-mono">{sourceCount} sources</span>
                {!hasEvidence && (
                  <span className="text-xs text-amber-500">Evidence unavailable for legacy brief</span>
                )}
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex gap-2">
              <Link
                href={`/chat?briefId=${encodeURIComponent(brief.postId)}&region=${encodeURIComponent(brief.region)}&portfolio=${encodeURIComponent(brief.portfolio)}`}
                className="btn-secondary text-sm"
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
          <section className="rounded-xl border border-border bg-card p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">1-minute decision panel</p>
                <h2 className="text-lg font-semibold text-foreground">Category Manager Decision Brief</h2>
              </div>
              {decisionSummary?.topMove && (
                <div className="hidden md:block rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  Top move: {decisionSummary.topMove}
                </div>
              )}
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-background p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground">What changed</h3>
                {(whatChanged.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground">No deltas captured yet.</p>
                ) : (
                  <ul className="space-y-2 text-sm text-foreground">
                    {whatChanged.slice(0, 3).map((item, idx) => (
                      <li key={`${item}-${idx}`} className="flex gap-2">
                        <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="rounded-lg border border-border bg-background p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Do next</h3>
                {doNextActions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No actions yet. Check the next run.</p>
                ) : (
                  <ul className="space-y-2 text-sm text-foreground">
                    {doNextActions.slice(0, 5).map((item, idx) => (
                      <li key={`${item}-${idx}`} className="flex gap-2">
                        <span className="mt-1 h-2 w-2 rounded-full bg-emerald-500" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="rounded-lg border border-border bg-background p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Supplier radar</h3>
                {(brief.cmSnapshot?.supplierRadar ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No supplier signals logged.</p>
                ) : (
                  <ul className="space-y-2 text-sm text-foreground">
                    {brief.cmSnapshot?.supplierRadar.slice(0, 4).map((item, idx) => (
                      <li key={`${item.supplier}-${idx}`} className="space-y-1">
                        <p className="font-semibold">{item.supplier}</p>
                        <p className="text-muted-foreground">{item.signal}</p>
                        <p className="text-xs text-muted-foreground">Next: {item.nextStep}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="rounded-lg border border-border bg-background p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Negotiation levers</h3>
                {(brief.cmSnapshot?.negotiationLevers ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No levers captured.</p>
                ) : (
                  <ul className="space-y-2 text-sm text-foreground">
                    {brief.cmSnapshot?.negotiationLevers.slice(0, 4).map((item, idx) => (
                      <li key={`${item.lever}-${idx}`}>
                        <p className="font-semibold">{item.lever}</p>
                        <p className="text-xs text-muted-foreground">{item.whenToUse}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="rounded-lg border border-border bg-background p-4 space-y-2 lg:col-span-2">
                <h3 className="text-sm font-semibold text-foreground">Risk & triggers</h3>
                {(brief.vpSnapshot?.riskRegister ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No risks captured.</p>
                ) : (
                  <ul className="grid gap-3 md:grid-cols-2 text-sm text-foreground">
                    {brief.vpSnapshot?.riskRegister.slice(0, 4).map((risk, idx) => (
                      <li key={`${risk.risk}-${idx}`} className="rounded-md border border-border bg-muted/40 p-3">
                        <p className="font-semibold">{risk.risk}</p>
                        <p className="text-xs text-muted-foreground">Trigger: {risk.trigger}</p>
                        <p className="text-xs text-muted-foreground">Mitigation: {risk.mitigation}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {watchThisWeek.length > 0 && (
                <div className="rounded-lg border border-border bg-background p-4 space-y-2 lg:col-span-2">
                  <h3 className="text-sm font-semibold text-foreground">Watch this week</h3>
                  <ul className="grid gap-2 md:grid-cols-2 text-sm text-foreground">
                    {watchThisWeek.slice(0, 4).map((item, idx) => (
                      <li key={`${item}-${idx}`} className="flex gap-2">
                        <span className="mt-1 h-2 w-2 rounded-full bg-amber-500" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>

          {brief.marketSnapshot && brief.marketSnapshot.length > 0 && (
            <MarketSnapshotTiles items={brief.marketSnapshot} />
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
            {hasEvidence ? (
              <span>Evidence-backed: {evidenceStats.supported} | Analysis: {evidenceStats.analysis}</span>
            ) : (
              <span>Evidence unavailable for legacy brief.</span>
            )}
            <a href="#evidence-audit" className="text-primary hover:underline">
              View evidence & sources
            </a>
          </div>

          {/* Executive Summary Section - Premium card */}
          {brief.summary && (
            <div className="relative rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-6 overflow-hidden">
              {/* Decorative element */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl" />
              
              <div className="relative">
                <div className="flex items-center gap-2 mb-4">
                  <div className="accent-line" />
                  <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-primary">
                    Executive Summary
                  </h2>
                </div>
                <p className="font-display text-lg leading-relaxed text-foreground font-medium">
                  {brief.summary}
                </p>
              </div>
            </div>
          )}

          {keyData.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <span role="img" aria-label="data">📌</span>
                <h2 className="text-sm font-semibold text-foreground">Key Data</h2>
              </div>
              <ul className="list-disc space-y-2 pl-5 text-sm text-foreground">
                {keyData.map((metric) => (
                  <li key={metric}>{metric}</li>
                ))}
              </ul>
            </div>
          )}

          {brief.cmSnapshot && <CmSnapshotPanel brief={brief} />}
          {brief.vpSnapshot && <VpSnapshotPanel brief={brief} />}

          {/* Selected Articles with Enhanced Cards */}
          {selectedArticles.length > 0 && (
            <div className="rounded-xl border border-border bg-secondary/20">
              <details className="group" open>
                <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-foreground flex items-center gap-2">
                  <svg className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                  Top Stories
                </summary>
                <div className="px-5 pb-5">
                  <ArticleList articles={selectedArticles} />
                </div>
              </details>
            </div>
          )}

          {brief.marketIndicators && brief.marketIndicators.length > 0 && (
            <div className="rounded-xl border border-border bg-card">
              <details className="group" open={false}>
                <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-foreground flex items-center gap-2">
                  <svg className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                  Market Indicators
                </summary>
                <div className="px-5 pb-5">
                  <ul className="space-y-3">
                    {brief.marketIndicators.map((indicator) => (
                      <li key={indicator.id} className="p-3 rounded-lg bg-secondary/50 border border-border">
                        <div className="font-medium text-foreground text-sm">{indicator.label}</div>
                        <div className="text-sm text-muted-foreground mt-1 leading-relaxed">{indicator.note}</div>
                        {(() => {
                          const indicatorSourceId = indicator.sourceId ?? (indicator.url ? buildSourceId(indicator.url) : "");
                          const isVerified = !indicatorSourceId || allowedSourceIds.size === 0 || allowedSourceIds.has(indicatorSourceId);
                          return isVerified ? (
                            <a
                              href={indicator.url}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="inline-flex items-center gap-1 text-primary text-xs mt-2 hover:underline"
                            >
                              View source
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                              </svg>
                            </a>
                          ) : (
                            <p className="text-xs text-amber-500 mt-2">Verification needed for this indicator.</p>
                          );
                        })()}
                      </li>
                    ))}
                  </ul>
                </div>
              </details>
            </div>
          )}

          {brief.bodyMarkdown && (
            <div className="rounded-xl border border-border bg-secondary/30">
              <details className="group" aria-label="Raw brief markdown">
                <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-foreground group-open:border-b group-open:border-border flex items-center gap-2">
                  <svg className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                  Developer / Export view
                </summary>
                <div className="prose prose-sm max-w-none px-5 pb-5 pt-4 dark:prose-invert prose-headings:font-display prose-headings:text-foreground prose-p:text-muted-foreground prose-strong:text-foreground prose-a:text-primary">
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
              </details>
            </div>
          )}

          {/* Evidence & Sources (Audit) */}
          {(hasEvidence || sources.length > 0) && (
            <div className="rounded-xl border border-border bg-card" id="evidence-audit">
              <details className="group">
                <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-foreground flex items-center gap-2">
                  <svg className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                  Evidence &amp; Sources (Audit)
                </summary>
                <div className="space-y-6 px-5 pb-5">
                  {hasEvidence && <BriefClaims claims={brief.claims} sources={brief.sources} />}
                  {sources.length > 0 && (
                    <div className="pt-2">
                      <FooterSources sources={brief.sources} />
                    </div>
                  )}
                </div>
              </details>
            </div>
          )}
        </div>
      </article>

      {/* Bottom Navigation - Premium styling */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-card p-5">
        <Link
          href={`/${brief.region}/${brief.portfolio}`}
          className="group flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
        >
          <svg className="h-4 w-4 transition-transform group-hover:-translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          <span>More from {portfolioLabel(brief.portfolio)}</span>
        </Link>
        <Link
          href="/"
          className="group flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
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
