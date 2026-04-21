import React from "react";
import Link from "next/link";
import Image from "next/image";
import {
  BriefClaim,
  BriefCitedBullet,
  BriefPost,
  BriefReportImpactGroup,
  BriefSource,
  SelectedArticle,
  buildSourceId,
  normalizeBriefSources,
  portfolioLabel,
  regionLabel,
  toBriefViewModelV2
} from "@proof/shared";
import { CmSnapshotPanel } from "../../components/cm/CmSnapshotPanel";
import { NegotiationLevers } from "../../components/NegotiationLevers";
import { SupplierRadar } from "../../components/SupplierRadar";
import { VpSnapshotPanel } from "../../components/vp/VpSnapshotPanel";

const OPERATIONAL_PATTERNS: RegExp[] = [
  /brief generation failed/gi,
  /carrying forward(?: the)? (?:most recent|latest) brief/gi,
  /no material change detected today/gi,
  /automated refresh was unavailable(?: this cycle)?/gi,
  /using(?: the)? (?:most recent|latest) brief/gi,
  /no material category-specific items detected today/gi,
  /latest available intelligence snapshot(?: for this region)?/gi,
  /coverage fallback/gi
];

type SourceExplorerCard = {
  source: BriefSource;
  number: number;
  article?: SelectedArticle;
  excerpts: string[];
  claimHighlights: string[];
};

function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/[#>*_~\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizePresentationText(value?: string): string | undefined {
  if (!value) return undefined;
  let cleaned = value.replace(/\s+/g, " ").trim();
  if (!cleaned) return undefined;
  for (const pattern of OPERATIONAL_PATTERNS) {
    cleaned = cleaned.replace(pattern, " ");
  }
  cleaned = cleaned.replace(/\s+/g, " ").replace(/\s+([,.;:!?])/g, "$1").trim();
  cleaned = cleaned.replace(/^[,;:. -]+/, "").replace(/[;,.:-]+$/, "").trim();
  if (!cleaned) return undefined;
  if (/^(no material|no published|no update|pending update)/i.test(cleaned)) return undefined;
  return cleaned;
}

function unique(items: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const item of items) {
    const value = sanitizePresentationText(item);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    output.push(value);
  }
  return output;
}

function isUsefulKeyFact(value?: string): boolean {
  if (!value) return false;
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (!cleaned) return false;
  if (!/[a-z]/i.test(cleaned)) return false;
  if (/^(19|20)\d{2}$/.test(cleaned)) return false;
  if (/^\d[\d.,%/$-]*$/.test(cleaned)) return false;
  return cleaned.length >= 8;
}

function selectKeyFacts(values?: Array<string | undefined>, maxItems = 4): string[] {
  return unique(values ?? []).filter((item) => isUsefulKeyFact(item)).slice(0, maxItems);
}

function deriveSummary(brief: BriefPost): string {
  return sanitizePresentationText(brief.summary?.trim()) ||
    sanitizePresentationText(brief.decisionSummary?.topMove?.trim()) ||
    sanitizePresentationText(stripMarkdown(brief.bodyMarkdown).slice(0, 420)) ||
    "No summary was available in this brief.";
}

function deriveImpact(brief: BriefPost): string[] {
  const items = unique([
    ...(brief.decisionSummary?.whatChanged ?? []),
    ...(brief.highlights ?? []),
    ...(brief.deltaSinceLastRun ?? []),
    brief.vpSnapshot?.health?.narrative,
    ...(brief.vpSnapshot?.topSignals ?? []).map((signal) => `${signal.title}: ${signal.impact}`),
    ...(brief.marketIndicators ?? []).map((indicator) => `${indicator.label}: ${indicator.note}`)
  ]);
  if (items.length > 0) return items.slice(0, 10);

  const fallback = stripMarkdown(brief.bodyMarkdown);
  if (!fallback) return ["Impact details were not available for this brief."];
  return [fallback.slice(0, 260)];
}

function deriveActions(brief: BriefPost): string[] {
  const items = unique([
    ...(brief.decisionSummary?.doNext ?? []),
    ...(brief.procurementActions ?? []),
    ...(brief.vpSnapshot?.recommendedActions ?? []).map((action) => action.action),
    ...(brief.cmSnapshot?.todayPriorities ?? []).map((priority) => priority.title)
  ]);
  if (items.length > 0) return items.slice(0, 10);
  return ["Review current category signals and adjust supplier engagement priorities accordingly."];
}

function deriveWatchItems(brief: BriefPost): string[] {
  const items = unique([
    ...(brief.decisionSummary?.watchThisWeek ?? []),
    ...(brief.watchlist ?? []),
    ...(brief.vpSnapshot?.riskRegister ?? []).map((risk) => `${risk.risk}: ${risk.trigger}`),
    ...(brief.cmSnapshot?.talkingPoints ?? [])
  ]);
  return items.slice(0, 8);
}

function deriveSources(brief: BriefPost): BriefSource[] {
  const sourcesById = new Map<string, BriefSource>();
  for (const source of normalizeBriefSources(brief.sources)) {
    sourcesById.set(source.sourceId, source);
  }

  for (const article of brief.selectedArticles ?? []) {
    if (!article.url) continue;
    const sourceId = article.sourceId ?? buildSourceId(article.url);
    if (!sourcesById.has(sourceId)) {
      sourcesById.set(sourceId, {
        sourceId,
        url: article.url,
        title: article.title,
        publishedAt: article.publishedAt
      });
    }
  }

  for (const indicator of brief.marketIndicators ?? []) {
    if (!indicator.url) continue;
    const sourceId = indicator.sourceId ?? buildSourceId(indicator.url);
    if (!sourcesById.has(sourceId)) {
      sourcesById.set(sourceId, {
        sourceId,
        url: indicator.url,
        title: indicator.label
      });
    }
  }

  return Array.from(sourcesById.values()).sort((a, b) => {
    const aDate = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const bDate = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return bDate - aDate;
  });
}

function sourceLabel(source: BriefSource): string {
  if (source.title?.trim()) return source.title.trim();
  try {
    return new URL(source.url).hostname.replace(/^www\./, "");
  } catch {
    return source.url;
  }
}

function sourcePublisher(source: BriefSource): string {
  try {
    return new URL(source.url).hostname.replace(/^www\./, "");
  } catch {
    return "source";
  }
}

function sourceDate(source: BriefSource): string {
  if (!source.publishedAt) return "n.d.";
  return new Date(source.publishedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function citationNumbers(sourceIds: string[], sourceNumberById: Map<string, number>): number[] {
  return Array.from(
    new Set(sourceIds.map((sourceId) => sourceNumberById.get(sourceId)).filter((value): value is number => Number.isFinite(value)))
  );
}

function renderCitationLinks(
  sourceIds: string[],
  sourceNumberById: Map<string, number>,
  keyPrefix: string
): React.ReactNode {
  const refs = citationNumbers(sourceIds, sourceNumberById);
  if (refs.length === 0) return null;

  return (
    <span className="inline-flex flex-wrap gap-1 text-xs font-semibold text-primary">
      {refs.map((ref) => (
        <a
          key={`${keyPrefix}-${ref}`}
          href={`#source-${ref}`}
          className="rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 hover:bg-primary/15"
        >
          [{ref}]
        </a>
      ))}
    </span>
  );
}

function renderCitedBullet(
  bullet: BriefCitedBullet,
  sourceNumberById: Map<string, number>,
  keyPrefix: string
): React.ReactNode {
  return (
    <>
      <span>{bullet.text}</span>
      {renderCitationLinks(bullet.sourceIds, sourceNumberById, keyPrefix)}
    </>
  );
}

function sourceIdForArticle(article: SelectedArticle): string | undefined {
  if (article.sourceId?.trim()) return article.sourceId;
  if (!article.url?.trim()) return undefined;
  return buildSourceId(article.url);
}

function buildSourceExplorerCards(
  brief: BriefPost,
  sources: BriefSource[],
  sourceNumberById: Map<string, number>
): SourceExplorerCard[] {
  const claimsBySourceId = new Map<string, BriefClaim[]>();
  for (const claim of brief.claims ?? []) {
    const sourceIds = new Set((claim.evidence ?? []).map((evidence) => evidence.sourceId));
    for (const sourceId of sourceIds) {
      const existing = claimsBySourceId.get(sourceId) ?? [];
      existing.push(claim);
      claimsBySourceId.set(sourceId, existing);
    }
  }

  return sources.map((source) => {
    const article = (brief.selectedArticles ?? []).find((item) => sourceIdForArticle(item) === source.sourceId || item.url === source.url);
    const claims = claimsBySourceId.get(source.sourceId) ?? [];
    const excerpts = unique(
      claims.flatMap((claim) =>
        (claim.evidence ?? [])
          .filter((evidence) => evidence.sourceId === source.sourceId)
          .map((evidence) => evidence.excerpt)
      )
    ).slice(0, 3);
    const claimHighlights = unique(claims.map((claim) => claim.text)).slice(0, 3);

    return {
      source,
      number: sourceNumberById.get(source.sourceId) ?? 0,
      article,
      excerpts,
      claimHighlights
    };
  });
}

const ACTION_HORIZON_DISPLAY: Record<string, string> = {
  "Next 72 hours": "What to do now",
  "Next 2-4 weeks": "Next few weeks",
  "Next quarter": "Longer view"
};

function actionHorizonLabel(horizon: string): string {
  return ACTION_HORIZON_DISPLAY[horizon] ?? horizon;
}

/**
 * Layered category brief with source-backed reading flow.
 */
export function BriefDetailContent({ brief }: { brief: BriefPost }): React.ReactElement {
  const view = toBriefViewModelV2(brief, { defaultRegion: brief.region });
  const fallbackSummary = deriveSummary(brief);
  const fallbackImpact = deriveImpact(brief);
  const fallbackActions = deriveActions(brief);
  const watchItems = deriveWatchItems(brief);
  const sources = deriveSources(brief);
  const sourceNumberById = new Map(sources.map((source, index) => [source.sourceId, index + 1]));
  const reportImpactGroups: BriefReportImpactGroup[] = brief.report?.impactGroups ?? [];
  const reportActionGroups = brief.report?.actionGroups ?? [];
  const marketSnapshot = (brief.marketSnapshot ?? []).slice(0, 6);
  const marketNotes = unique((brief.marketIndicators ?? []).map((indicator) => `${indicator.label}: ${indicator.note}`)).slice(0, 5);
  const shouldRenderHero =
    view.heroImage.url.startsWith("https://") && !/daily intel report/i.test(view.heroImage.alt);
  const topMove = sanitizePresentationText(brief.decisionSummary?.topMove) || fallbackSummary;

  const keyTakeaways = brief.report?.summaryBullets?.length
    ? brief.report.summaryBullets.slice(0, 5)
    : fallbackImpact.slice(0, 5).map((item) => ({ text: item, sourceIds: [] as string[] }));
  const executiveKeyFacts = selectKeyFacts(
    view.topStories.flatMap((story) => (story.keyMetrics ?? []).map((metric) => sanitizePresentationText(metric))),
    6
  );
  const storyArticles = (brief.selectedArticles ?? []).slice(0, 5);
  const sourceExplorerCards = buildSourceExplorerCards(brief, sources, sourceNumberById);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {portfolioLabel(brief.portfolio)} · {regionLabel(view.region)}
            </p>
            <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">{view.title}</h1>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>Published {view.dateLabel}</span>
              <span className="text-border">•</span>
              <span>{brief.runWindow.toUpperCase()}</span>
              <span className="text-border">•</span>
              <span>{brief.newsStatus === "ok" ? "Full category signal" : "Light-signal edition"}</span>
            </div>
          </div>
          <Link
            href={`/chat?briefId=${encodeURIComponent(brief.postId)}&region=${encodeURIComponent(brief.region)}&portfolio=${encodeURIComponent(brief.portfolio)}`}
            className="btn-secondary text-sm"
          >
            Ask AI
          </Link>
        </div>
      </header>

      {shouldRenderHero ? (
        <section className="rounded-xl border border-border bg-card p-5">
          <Image
            src={view.heroImage.url}
            alt={view.heroImage.alt}
            width={1600}
            height={900}
            sizes="(min-width: 1024px) 1024px, 100vw"
            unoptimized
            className="h-64 w-full rounded-lg border border-border bg-background object-cover sm:h-80"
            loading="eager"
          />
        </section>
      ) : null}

      {view.contextNote ? (
        <section className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">Coverage note</p>
          <p className="mt-3 text-sm leading-relaxed text-amber-100">{view.contextNote}</p>
        </section>
      ) : null}

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">In 60 seconds</h2>
            <p className="mt-1 text-sm text-muted-foreground">Start here for the short version before you read deeper.</p>
          </div>
          <div className="rounded-lg border border-primary/20 bg-primary/10 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Top move</p>
            <p className="mt-2 max-w-xl text-sm font-medium text-foreground">{topMove}</p>
          </div>
        </div>

        <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Key takeaways</p>
            {keyTakeaways.length > 0 ? (
              <ul className="mt-3 space-y-3 text-sm text-foreground">
                {keyTakeaways.map((bullet, idx) => (
                  <li key={`takeaway-${idx}`} className="flex gap-3 rounded-lg border border-border bg-background px-4 py-3">
                    <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
                    <div className="space-y-2">
                      {typeof bullet === "string" ? <span>{bullet}</span> : renderCitedBullet(bullet, sourceNumberById, `takeaway-${idx}`)}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">No takeaways were available for this brief.</p>
            )}
          </div>

          <div className="space-y-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">What changed since last run</p>
              {view.deltaBullets.length > 0 ? (
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {view.deltaBullets.slice(0, 3).map((item, idx) => (
                    <li key={`${item}-${idx}`} className="flex gap-2">
                      <span className="mt-1 h-2 w-2 rounded-full bg-muted-foreground/60" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">No prior run was available for comparison.</p>
              )}
            </div>

            {executiveKeyFacts.length > 0 ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Key facts</p>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {executiveKeyFacts.map((metric) => (
                    <li key={metric} className="flex gap-2 rounded-lg border border-sky-400/20 bg-sky-500/10 px-3 py-2">
                      <span className="mt-1 h-2 w-2 rounded-full bg-sky-300" />
                      <span className="text-sky-50">{metric}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold text-foreground">Why it matters</h2>
        <p className="mt-3 text-sm leading-relaxed text-foreground">{fallbackSummary}</p>

        {reportImpactGroups.length > 0 ? (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {reportImpactGroups.map((group) => (
              <div key={group.label} className="rounded-lg border border-border bg-background p-4">
                <h3 className="text-sm font-semibold text-foreground">{group.label}</h3>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {group.bullets.slice(0, 4).map((bullet, idx) => (
                    <li key={`${group.label}-${idx}`} className="flex gap-2">
                      <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
                      <div className="space-y-2">{renderCitedBullet(bullet, sourceNumberById, `${group.label}-${idx}`)}</div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            {fallbackImpact.map((item, idx) => (
              <li key={`${item}-${idx}`} className="flex gap-2">
                <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {storyArticles.length > 0 ? (
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Top stories</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Each story is summarized in plain English, with the category takeaway and source trail attached.
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {storyArticles.map((article, idx) => {
              const sourceId = sourceIdForArticle(article);
              const sourceNumber = sourceId ? sourceNumberById.get(sourceId) : undefined;
              const sourceCard = sourceId ? sourceExplorerCards.find((card) => card.source.sourceId === sourceId) : undefined;
              const storyKeyFacts = selectKeyFacts(article.keyMetrics, 4);

              return (
                <article key={`${article.url}-${idx}`} className="rounded-xl border border-border bg-background p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="rounded-full border border-border px-2 py-1">Story {idx + 1}</span>
                        {article.sourceName ? <span>{article.sourceName}</span> : null}
                        {article.publishedAt ? (
                          <>
                            <span className="text-border">•</span>
                            <span>{new Date(article.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                          </>
                        ) : null}
                      </div>
                      <h3 className="text-base font-semibold text-foreground">{article.title}</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {sourceNumber ? (
                        <a href={`#source-${sourceNumber}`} className="btn-secondary text-xs">
                          Source notes [{sourceNumber}]
                        </a>
                      ) : null}
                      <a href={article.url} target="_blank" rel="noreferrer noopener" className="btn-secondary text-xs">
                        Read source
                      </a>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">What happened</p>
                        <p className="mt-2 text-sm leading-relaxed text-foreground">
                          {sanitizePresentationText(article.briefContent) ?? "No article summary was stored for this story."}
                        </p>
                      </div>

                      {article.categoryImportance ? (
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Why this matters for this category</p>
                          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{sanitizePresentationText(article.categoryImportance)}</p>
                        </div>
                      ) : null}
                    </div>

                    <div className="space-y-4">
                      {storyKeyFacts.length > 0 ? (
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Key facts</p>
                          <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                            {storyKeyFacts.map((metric) => (
                              <li key={metric} className="flex gap-2">
                                <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
                                <span className="text-foreground">{metric}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      {sourceCard?.excerpts.length ? (
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Source excerpts</p>
                          <div className="mt-2 space-y-2">
                            {sourceCard.excerpts.map((excerpt) => (
                              <blockquote key={excerpt} className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
                                {excerpt}
                              </blockquote>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {brief.vpSnapshot ? <VpSnapshotPanel brief={brief} /> : null}

      {brief.cmSnapshot ? <CmSnapshotPanel brief={brief} /> : null}

      {brief.cmSnapshot?.supplierRadar?.length ? (
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-lg font-semibold text-foreground">Supplier radar</h2>
          <SupplierRadar brief={brief} />
        </section>
      ) : null}

      {brief.cmSnapshot?.negotiationLevers?.length ? (
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-lg font-semibold text-foreground">Negotiation levers</h2>
          <NegotiationLevers brief={brief} />
        </section>
      ) : null}

      {(reportActionGroups.length > 0 || fallbackActions.length > 0 || watchItems.length > 0) ? (
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-lg font-semibold text-foreground">What to do / What to watch</h2>
          <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.9fr)]">
            <div>
              {reportActionGroups.length > 0 ? (
                <div className="space-y-4">
                  {reportActionGroups.map((group) => (
                    <div key={group.horizon}>
                      <h3 className="text-sm font-semibold text-foreground">{actionHorizonLabel(group.horizon)}</h3>
                      <ul className="mt-3 space-y-3 text-sm text-muted-foreground">
                        {group.actions.map((action, idx) => (
                          <li key={`${group.horizon}-${idx}`}>
                            <details className="rounded-lg border border-border bg-background px-4 py-3">
                              <summary className="cursor-pointer text-sm font-medium text-foreground hover:text-primary">
                                {action.action}
                              </summary>
                              <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                                <p>
                                  <span className="font-semibold text-foreground">Why:</span> {action.rationale}
                                </p>
                                <p>
                                  <span className="font-semibold text-foreground">Owner:</span> {action.owner}
                                </p>
                                <p>
                                  <span className="font-semibold text-foreground">Expected outcome:</span> {action.expectedOutcome}
                                </p>
                                {renderCitationLinks(action.sourceIds, sourceNumberById, `${group.horizon}-${idx}`)}
                              </div>
                            </details>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : (
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {fallbackActions.map((item, idx) => (
                    <li key={`${item}-${idx}`} className="flex gap-2">
                      <span className="mt-1 h-2 w-2 rounded-full bg-amber-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-xl border border-border bg-background p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">What to watch</p>
              {watchItems.length > 0 ? (
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {watchItems.map((item, idx) => (
                    <li key={`${item}-${idx}`} className="flex gap-2">
                      <span className="mt-1 h-2 w-2 rounded-full bg-sky-400/80" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">No watch items were attached to this brief.</p>
              )}
            </div>
          </div>
        </section>
      ) : null}

      {(marketSnapshot.length > 0 || marketNotes.length > 0) ? (
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-lg font-semibold text-foreground">Market pulse</h2>
          {marketSnapshot.length > 0 ? (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full table-fixed border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="px-3 py-2 text-left">Index</th>
                    <th className="px-3 py-2 text-right">Latest</th>
                    <th className="px-3 py-2 text-right">Change</th>
                    <th className="px-3 py-2 text-left">As of</th>
                  </tr>
                </thead>
                <tbody>
                  {marketSnapshot.map((item) => (
                    <tr
                      key={`${item.symbol}-${item.asOf}-${item.latest}`}
                      className="border-b border-border/80 last:border-0"
                    >
                      <td className="px-3 py-2 text-foreground">
                        {item.name} <span className="text-muted-foreground">({item.symbol})</span>
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-foreground">
                        {Number(item.latest).toLocaleString("en-US", { maximumFractionDigits: 2 })} {item.unit}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span className={item.change >= 0 ? "text-emerald-400" : "text-rose-400"}>
                          {`${item.change >= 0 ? "+" : ""}${item.change.toFixed(2)} (${item.changePercent >= 0 ? "+" : ""}${item.changePercent.toFixed(2)}%)`}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {new Date(item.asOf).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {marketNotes.length > 0 ? (
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              {marketNotes.map((note, idx) => (
                <li key={`${note}-${idx}`} className="flex gap-2">
                  <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Sources</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Inline citations jump here. Expand a source to read the excerpt, the AI interpretation, and the original link.
            </p>
          </div>
        </div>

        {sourceExplorerCards.length > 0 ? (
          <div className="mt-5 space-y-3">
            {sourceExplorerCards.map((card) => {
              const sourceKeyFacts = selectKeyFacts(card.article?.keyMetrics, 4);
              return (
                <details
                  key={card.source.sourceId}
                  id={`source-${card.number}`}
                  className="rounded-xl border border-border bg-background px-4 py-3"
                >
                  <summary className="cursor-pointer list-none">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">
                          [{card.number}] {sourceLabel(card.source)}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {sourcePublisher(card.source)} · {sourceDate(card.source)}
                        </p>
                      </div>
                      <span className="text-xs font-medium text-primary">Expand</span>
                    </div>
                  </summary>

                  <div className="mt-4 space-y-4 border-t border-border pt-4">
                    {card.article?.briefContent ? (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">AI reading</p>
                        <p className="mt-2 text-sm leading-relaxed text-foreground">{sanitizePresentationText(card.article.briefContent)}</p>
                      </div>
                    ) : null}

                    {card.article?.categoryImportance ? (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Why it matters</p>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                          {sanitizePresentationText(card.article.categoryImportance)}
                        </p>
                      </div>
                    ) : null}

                    {sourceKeyFacts.length > 0 ? (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Key facts</p>
                        <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                          {sourceKeyFacts.map((metric) => (
                            <li key={metric} className="flex gap-2">
                              <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
                              <span className="text-foreground">{metric}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {card.excerpts.length > 0 ? (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Source excerpts</p>
                        <div className="mt-2 space-y-2">
                          {card.excerpts.map((excerpt) => (
                            <blockquote key={excerpt} className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
                              {excerpt}
                            </blockquote>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {card.claimHighlights.length > 0 ? (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Used in this brief</p>
                        <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                          {card.claimHighlights.map((claim) => (
                            <li key={claim} className="flex gap-2">
                              <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
                              <span>{claim}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    <a
                      href={card.source.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                    >
                    Open original source
                    </a>
                  </div>
                </details>
              );
            })}
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">No source links were attached to this brief.</p>
        )}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-5">
        <Link href={`/portfolio/${brief.portfolio}`} className="text-sm font-medium text-muted-foreground hover:text-primary">
          More from {portfolioLabel(brief.portfolio)}
        </Link>
        <Link href="/" className="text-sm font-medium text-muted-foreground hover:text-primary">
          Back to Executive View
        </Link>
      </div>
    </div>
  );
}
