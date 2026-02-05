import Link from "next/link";
import {
  BriefPost,
  BriefSource,
  buildSourceId,
  normalizeBriefSources,
  portfolioLabel,
  regionLabel
} from "@proof/shared";

function toDateLabel(value: string): string {
  const date = new Date(value);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

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

function unique(items: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const item of items) {
    if (!item) continue;
    const value = item.trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    output.push(value);
  }
  return output;
}

function deriveSummary(brief: BriefPost): string {
  return (
    brief.summary?.trim() ||
    brief.decisionSummary?.topMove?.trim() ||
    stripMarkdown(brief.bodyMarkdown).slice(0, 420) ||
    "No summary was available in this brief."
  );
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
  return ["No explicit actions were published in this edition."];
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

/**
 * Cohesive single-flow brief report.
 */
export function BriefDetailContent({ brief }: { brief: BriefPost }) {
  const summary = deriveSummary(brief);
  const impact = deriveImpact(brief);
  const actions = deriveActions(brief);
  const sources = deriveSources(brief);
  const isCarryForward = brief.generationStatus === "no-updates" || brief.generationStatus === "generation-failed";

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header className="rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {portfolioLabel(brief.portfolio)} · {regionLabel(brief.region)}
            </p>
            <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">{brief.title}</h1>
            <p className="text-sm text-muted-foreground">Published {toDateLabel(brief.publishedAt)}</p>
          </div>
          <Link
            href={`/chat?briefId=${encodeURIComponent(brief.postId)}&region=${encodeURIComponent(brief.region)}&portfolio=${encodeURIComponent(brief.portfolio)}`}
            className="btn-secondary text-sm"
          >
            Ask AI
          </Link>
        </div>
        {isCarryForward ? (
          <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
            Carry-forward edition: published today because no material update or generation failure occurred in this cycle.
          </p>
        ) : null}
      </header>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold text-foreground">Summary</h2>
        <p className="mt-3 text-sm text-foreground leading-relaxed">{summary}</p>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold text-foreground">Impact</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          {impact.map((item, idx) => (
            <li key={`${item}-${idx}`} className="flex gap-2">
              <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold text-foreground">Possible actions</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          {actions.map((item, idx) => (
            <li key={`${item}-${idx}`} className="flex gap-2">
              <span className="mt-1 h-2 w-2 rounded-full bg-amber-500" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold text-foreground">Sources</h2>
        <div className="mt-3 space-y-2">
          {sources.map((source) => (
            <a
              key={source.sourceId}
              href={source.url}
              target="_blank"
              rel="noreferrer noopener"
              className="block rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground transition hover:border-primary/40"
            >
              <p className="font-medium line-clamp-1">{sourceLabel(source)}</p>
              <p className="mt-1 text-xs text-muted-foreground line-clamp-1">{source.url}</p>
            </a>
          ))}
          {sources.length === 0 ? <p className="text-sm text-muted-foreground">No source links were attached to this brief.</p> : null}
        </div>
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

