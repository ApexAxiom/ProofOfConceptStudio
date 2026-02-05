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
import { inferSignals } from "../../lib/signals";
import { extractValidUrl } from "../../lib/url";
import {
  BriefPost,
  REGIONS,
  buildSourceId,
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
 * Displays the decision memo for a single intelligence brief.
 */
export function BriefDetailContent({ brief }: { brief: BriefPost }) {
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
  const decisionSummary = brief.decisionSummary;
  const whatChanged = decisionSummary?.whatChanged?.length
    ? decisionSummary.whatChanged
    : brief.deltaSinceLastRun ?? [];
  const doNextActions = [
    ...(decisionSummary?.doNext ?? []),
    ...(decisionSummary?.doNext?.length ? [] : brief.procurementActions ?? [])
  ].filter(Boolean);
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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          href={`/${brief.region}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Back to {REGIONS[brief.region].city}
        </Link>
        <RegionTabs activeRegion={brief.region} />
      </div>

      <header className="rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {portfolioLabel(brief.portfolio)} · {regionLabel(brief.region)}
            </p>
            <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">{brief.title}</h1>
            <p className="text-sm text-muted-foreground">
              Published {publishedDate} · {publishedTime}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/chat?briefId=${encodeURIComponent(brief.postId)}&region=${encodeURIComponent(brief.region)}&portfolio=${encodeURIComponent(brief.portfolio)}`}
              className="btn-secondary text-sm"
            >
              Ask AI
            </Link>
            {primarySourceUrl && (
              <a href={primarySourceUrl} target="_blank" rel="noreferrer" className="btn-secondary text-sm">
                Open primary source
              </a>
            )}
            <CopyActionsButton actions={brief.procurementActions ?? []} />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {signals.slice(0, 3).map((signal) => (
            <span key={signal.type} className="signal-chip text-[10px]">
              {signal.label}
            </span>
          ))}
        </div>

        {heroImageUrl && (
          <div className="mt-5 overflow-hidden rounded-xl border border-border bg-secondary/30">
            <ProxiedImage
              src={heroImageUrl}
              alt={brief.heroImageAlt ?? brief.title}
              className="h-56 w-full object-cover"
              loading="eager"
            />
          </div>
        )}
      </header>

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Decision Memo</p>
            {brief.summary ? (
              <p className="mt-3 text-base font-medium text-foreground">{brief.summary}</p>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">Summary will appear once the brief is fully populated.</p>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold text-foreground">What changed</h2>
            {whatChanged.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No deltas captured yet.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm text-foreground">
                {whatChanged.slice(0, 5).map((item, idx) => (
                  <li key={`${item}-${idx}`} className="flex gap-2">
                    <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {(brief.vpSnapshot?.health?.narrative || brief.vpSnapshot?.topSignals?.length) && (
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-sm font-semibold text-foreground">Category impact</h2>
              {brief.vpSnapshot?.health?.narrative && (
                <p className="mt-2 text-sm text-muted-foreground">{brief.vpSnapshot.health.narrative}</p>
              )}
              {brief.vpSnapshot?.topSignals?.length ? (
                <div className="mt-4 space-y-2">
                  {brief.vpSnapshot.topSignals.slice(0, 3).map((signal, idx) => (
                    <div key={`${signal.title}-${idx}`} className="rounded-lg border border-border bg-background px-3 py-2">
                      <p className="text-sm font-semibold text-foreground">{signal.title}</p>
                      <p className="text-xs text-muted-foreground">Impact: {signal.impact}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          )}

          {watchThisWeek.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-sm font-semibold text-foreground">Watch this week</h2>
              <ul className="mt-3 grid gap-2 text-sm text-foreground sm:grid-cols-2">
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

        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold text-foreground">Recommended actions</h2>
            {doNextActions.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No actions yet. Check the next run.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm text-foreground">
                {doNextActions.slice(0, 5).map((item, idx) => (
                  <li key={`${item}-${idx}`} className="rounded-lg border border-border bg-background px-3 py-2">
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <details className="rounded-xl border border-border bg-card">
          <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-foreground">
            Supporting intelligence
          </summary>
          <div className="space-y-6 px-5 pb-5">
            {(brief.cmSnapshot?.supplierRadar ?? []).length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-foreground">Supplier radar</h3>
                <ul className="mt-3 space-y-3 text-sm text-foreground">
                  {brief.cmSnapshot?.supplierRadar.slice(0, 4).map((item, idx) => (
                    <li key={`${item.supplier}-${idx}`} className="rounded-lg border border-border bg-background px-3 py-2">
                      <p className="font-semibold">{item.supplier}</p>
                      <p className="text-xs text-muted-foreground">{item.signal}</p>
                      <p className="text-xs text-muted-foreground">Next: {item.nextStep}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {(brief.cmSnapshot?.negotiationLevers ?? []).length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-foreground">Negotiation levers</h3>
                <ul className="mt-3 space-y-2 text-sm text-foreground">
                  {brief.cmSnapshot?.negotiationLevers.slice(0, 4).map((item, idx) => (
                    <li key={`${item.lever}-${idx}`} className="rounded-lg border border-border bg-background px-3 py-2">
                      <p className="font-semibold">{item.lever}</p>
                      <p className="text-xs text-muted-foreground">{item.whenToUse}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {(brief.vpSnapshot?.riskRegister ?? []).length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-foreground">Risks & triggers</h3>
                <ul className="mt-3 space-y-3 text-sm text-foreground">
                  {brief.vpSnapshot?.riskRegister.slice(0, 4).map((risk, idx) => (
                    <li key={`${risk.risk}-${idx}`} className="rounded-lg border border-border bg-background px-3 py-2">
                      <p className="font-semibold">{risk.risk}</p>
                      <p className="text-xs text-muted-foreground">Trigger: {risk.trigger}</p>
                      <p className="text-xs text-muted-foreground">Mitigation: {risk.mitigation}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="rounded-lg border border-border bg-background p-4">
              <h3 className="text-sm font-semibold text-foreground">Evidence & sources</h3>
              <div className="mt-2 text-xs text-muted-foreground">
                {hasEvidence ? (
                  <span>Evidence-backed: {evidenceStats.supported} | Analysis: {evidenceStats.analysis}</span>
                ) : (
                  <span>Evidence will appear once sources are mapped.</span>
                )}
              </div>
              {hasEvidence && <BriefClaims claims={brief.claims} sources={brief.sources} />}
              {selectedArticles.length > 0 && <ArticleList articles={selectedArticles} />}
              {sources.length > 0 && <FooterSources sources={brief.sources} />}
            </div>

            {(brief.marketSnapshot?.length || brief.marketIndicators?.length) && (
              <div className="rounded-lg border border-border bg-background p-4">
                <h3 className="text-sm font-semibold text-foreground">Market & benchmarks</h3>
                <div className="mt-3 space-y-4">
                  {brief.marketSnapshot && brief.marketSnapshot.length > 0 && (
                    <MarketSnapshotTiles items={brief.marketSnapshot} />
                  )}
                  {brief.marketIndicators && brief.marketIndicators.length > 0 && (
                    <ul className="space-y-3">
                      {brief.marketIndicators.map((indicator) => (
                        <li key={indicator.id} className="rounded-lg border border-border bg-background px-3 py-2">
                          <p className="text-sm font-semibold text-foreground">{indicator.label}</p>
                          <p className="text-xs text-muted-foreground">{indicator.note}</p>
                          {indicator.url && (
                            <a
                              href={indicator.url}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                            >
                              View source
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                              </svg>
                            </a>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}

            {brief.bodyMarkdown && (
              <div className="rounded-lg border border-border bg-background p-4">
                <h3 className="text-sm font-semibold text-foreground">Export & appendix</h3>
                <div className="prose prose-sm max-w-none pt-4 dark:prose-invert prose-headings:font-display prose-headings:text-foreground prose-p:text-muted-foreground prose-strong:text-foreground prose-a:text-primary">
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
              </div>
            )}
          </div>
        </details>
      </section>

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
          <span>Back to Morning Scan</span>
          <svg className="h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
