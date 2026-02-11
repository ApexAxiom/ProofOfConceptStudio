import React from "react";
import Link from "next/link";
import {
  BriefCitedBullet,
  BriefPost,
  BriefReportImpactGroup,
  BriefSource,
  buildSourceId,
  normalizeBriefSources,
  portfolioLabel,
  regionLabel,
  toBriefViewModelV2
} from "@proof/shared";

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

function citationLabel(sourceIds: string[], sourceNumberById: Map<string, number>): string {
  const refs = Array.from(
    new Set(sourceIds.map((sourceId) => sourceNumberById.get(sourceId)).filter((value): value is number => Number.isFinite(value)))
  );
  if (refs.length === 0) return "";
  return refs.map((value) => `[${value}]`).join("");
}

function renderCitedBullet(
  bullet: BriefCitedBullet,
  sourceNumberById: Map<string, number>
): string {
  return `${bullet.text} ${citationLabel(bullet.sourceIds, sourceNumberById)}`.trim();
}

const ACTION_HORIZON_DISPLAY: Record<string, string> = {
  // Display mapping only (do not change stored schema values).
  "Next 72 hours": "Short-term",
  "Next 2-4 weeks": "Mid-term",
  "Next quarter": "Long-term"
};

function actionHorizonLabel(horizon: string): string {
  return ACTION_HORIZON_DISPLAY[horizon] ?? horizon;
}

/**
 * Cohesive single-flow brief report.
 */
export function BriefDetailContent({ brief }: { brief: BriefPost }): React.ReactElement {
  const view = toBriefViewModelV2(brief, { defaultRegion: brief.region });
  const fallbackSummary = deriveSummary(brief);
  const fallbackImpact = deriveImpact(brief);
  const fallbackActions = deriveActions(brief);
  const sources = deriveSources(brief);
  const sourceNumberById = new Map(sources.map((source, index) => [source.sourceId, index + 1]));
  const reportImpactGroups: BriefReportImpactGroup[] = brief.report?.impactGroups ?? [];
  const reportActionGroups = brief.report?.actionGroups ?? [];
  const shouldRenderHero =
    view.heroImage.url.startsWith("https://") && !/daily intel report/i.test(view.heroImage.alt);

  const keyTakeaways = brief.report?.summaryBullets?.length
    ? brief.report.summaryBullets.slice(0, 3).map((bullet) => renderCitedBullet(bullet, sourceNumberById))
    : fallbackImpact.slice(0, 3);
  const executiveSummaryBullets = brief.report?.summaryBullets?.length
    ? brief.report.summaryBullets.slice(0, 5).map((bullet) => renderCitedBullet(bullet, sourceNumberById))
    : fallbackImpact.slice(0, 5);
  const executiveKeyFacts = Array.from(
    new Set(
      view.topStories
        .flatMap((story) => story.keyMetrics ?? [])
        .map((metric) => sanitizePresentationText(metric))
        .filter((metric): metric is string => Boolean(metric))
    )
  ).slice(0, 10);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header className="rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {portfolioLabel(brief.portfolio)} · {regionLabel(view.region)}
            </p>
            <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">{view.title}</h1>
            <p className="text-sm text-muted-foreground">Published {view.dateLabel}</p>
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
          <img
            src={view.heroImage.url}
            alt={view.heroImage.alt}
            className="h-64 w-full rounded-lg border border-border bg-background object-cover sm:h-80"
            loading="eager"
          />
        </section>
      ) : null}

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold text-foreground">Executive Snapshot</h2>
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Key takeaways</p>
            {keyTakeaways.length > 0 ? (
              <ul className="mt-3 space-y-2 text-sm text-foreground">
                {keyTakeaways.map((item, idx) => (
                  <li key={`takeaway-${idx}`} className="flex gap-2">
                    <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">No takeaways were available for this brief.</p>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              What changed since last run
            </p>
            {view.deltaBullets.length > 0 ? (
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                {view.deltaBullets.map((item, idx) => (
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
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold text-foreground">Executive Summary</h2>
        <p className="mt-3 text-sm text-foreground leading-relaxed">{fallbackSummary}</p>
        {executiveSummaryBullets.length > 0 ? (
          <ul className="mt-4 space-y-2 text-sm text-foreground">
            {executiveSummaryBullets.map((item, idx) => (
              <li key={`summary-${idx}`} className="flex gap-2">
                <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {executiveKeyFacts.length > 0 ? (
          <div className="mt-5 rounded-lg border border-border bg-background px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Key facts</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {executiveKeyFacts.map((metric) => (
                <li key={metric} className="rounded-full border border-sky-400/30 bg-sky-500/15 px-3 py-1 text-xs font-medium text-sky-100">
                  {metric}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold text-foreground">Impact</h2>
        {reportImpactGroups.length > 0 ? (
          <div className="mt-4 space-y-4">
            {reportImpactGroups.map((group) => {
              const primary = group.bullets.slice(0, 2);
              const remaining = group.bullets.slice(2);

              return (
                <div key={group.label} className="rounded-lg border border-border bg-background p-4">
                  <h3 className="text-sm font-semibold text-foreground">{group.label}</h3>
                  <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                    {primary.map((bullet, idx) => (
                      <li key={`${group.label}-${idx}`} className="flex gap-2">
                        <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
                        <span>{renderCitedBullet(bullet, sourceNumberById)}</span>
                      </li>
                    ))}
                  </ul>
                  {remaining.length > 0 ? (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-primary">
                        Show {remaining.length} more
                      </summary>
                      <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                        {remaining.map((bullet, idx) => (
                          <li key={`${group.label}-more-${idx}`} className="flex gap-2">
                            <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
                            <span>{renderCitedBullet(bullet, sourceNumberById)}</span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                </div>
              );
            })}
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

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold text-foreground">Action Plan</h2>
        {reportActionGroups.length > 0 ? (
          <div className="mt-4 space-y-4">
            {reportActionGroups.map((group) => (
              <div key={group.horizon}>
                <h3 className="text-sm font-semibold text-foreground">{actionHorizonLabel(group.horizon)}</h3>
                <ul className="mt-3 space-y-3 text-sm text-muted-foreground">
                  {group.actions.map((action, idx) => {
                    const refs = citationLabel(action.sourceIds, sourceNumberById);

                    return (
                      <li key={`${group.horizon}-${idx}`}>
                        <details className="rounded-lg border border-border bg-background px-4 py-3">
                          <summary className="cursor-pointer text-sm font-medium text-foreground hover:text-primary">
                            {action.action}{" "}
                            {refs ? <span className="text-muted-foreground font-semibold">{refs}</span> : null}
                          </summary>
                          <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                            <p>
                              <span className="font-semibold text-foreground">Rationale:</span> {action.rationale}
                            </p>
                            <p>
                              <span className="font-semibold text-foreground">Owner:</span> {action.owner}
                            </p>
                            <p>
                              <span className="font-semibold text-foreground">Expected outcome / KPI:</span>{" "}
                              {action.expectedOutcome}
                            </p>
                            {refs ? (
                              <p>
                                <span className="font-semibold text-foreground">Citations:</span> {refs}
                              </p>
                            ) : null}
                          </div>
                        </details>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            {fallbackActions.map((item, idx) => (
              <li key={`${item}-${idx}`} className="flex gap-2">
                <span className="mt-1 h-2 w-2 rounded-full bg-amber-500" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold text-foreground">Sources</h2>
        <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
          {sources.map((source, idx) => (
            <li key={source.sourceId} className="rounded-lg border border-border bg-background px-3 py-2">
              <span className="font-semibold text-foreground">[{idx + 1}] </span>
              <span className="text-foreground">{sourceLabel(source)}</span>
              <span> - {sourcePublisher(source)} ({sourceDate(source)}) - </span>
              <a href={source.url} target="_blank" rel="noreferrer noopener" className="text-primary hover:underline break-all">
                {source.url}
              </a>
            </li>
          ))}
          {sources.length === 0 ? <p className="text-sm text-muted-foreground">No source links were attached to this brief.</p> : null}
        </ol>
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
