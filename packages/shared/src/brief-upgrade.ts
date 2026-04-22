import { regionLabel } from "./regions.js";
import {
  BriefCitedBullet,
  BriefPost,
  BriefReport,
  BriefReportAction,
  BriefSource
} from "./types.js";
import { buildSourceId, normalizeBriefSources } from "./source-utils.js";

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function toBullet(text: string, defaultSourceId: string): BriefCitedBullet {
  return {
    text: text.replace(/\s+/g, " ").trim(),
    sourceIds: [defaultSourceId]
  };
}

export function normalizeUpgradeSources(brief: BriefPost): BriefSource[] {
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
  return Array.from(sourcesById.values()).slice(0, 20);
}

function classifyImpact(text: string): "market" | "supply" | "contracting" | "risk" {
  const lower = text.toLowerCase();
  if (/(price|cost|inflation|index|fx|brent|wti|gas|steel)/i.test(lower)) return "market";
  if (/(supplier|capacity|utilization|lead time|shortage|availability|fleet|labor)/i.test(lower)) return "supply";
  if (/(contract|tender|rfq|pricing term|clause|commercial|rate card|indexation|ltsa)/i.test(lower)) return "contracting";
  return "risk";
}

function ownerForAction(text: string): BriefReportAction["owner"] {
  const lower = text.toLowerCase();
  if (/(contract|term|clause|pricing|rfq|rfx|commercial)/i.test(lower)) return "Contracts";
  if (/(regulatory|compliance|legal|obligation|liability)/i.test(lower)) return "Legal";
  if (/(operation|schedule|logistics|execution|maintenance|turnaround)/i.test(lower)) return "Ops";
  return "Category";
}

function ensureCount<T>(items: T[], min: number, filler: () => T, max: number): T[] {
  const output = [...items];
  while (output.length < min) {
    output.push(filler());
  }
  return output.slice(0, max);
}

export function buildFallbackReport(brief: BriefPost, sourceIds: string[]): BriefReport {
  const defaultSourceId = sourceIds[0] ?? buildSourceId("https://proofofconceptstudio.com");
  const summarySeed = unique([
    brief.summary ?? "",
    ...(brief.highlights ?? []),
    ...(brief.decisionSummary?.whatChanged ?? []),
    ...(brief.deltaSinceLastRun ?? [])
  ]);

  const summaryBullets = ensureCount(
    summarySeed.slice(0, 8).map((text) => toBullet(text, defaultSourceId)),
    5,
    () => toBullet("No material change was detected beyond previously published conditions.", defaultSourceId),
    8
  );

  const impactSeed = unique([
    ...(brief.highlights ?? []),
    ...(brief.deltaSinceLastRun ?? []),
    ...(brief.watchlist ?? []),
    ...(brief.marketIndicators ?? []).map((indicator) => `${indicator.label}: ${indicator.note}`),
    ...(brief.vpSnapshot?.topSignals ?? []).map((signal) => `${signal.title}: ${signal.impact}`)
  ]);

  const buckets = {
    market: [] as BriefCitedBullet[],
    supply: [] as BriefCitedBullet[],
    contracting: [] as BriefCitedBullet[],
    risk: [] as BriefCitedBullet[]
  };

  for (const line of impactSeed) {
    const bucket = classifyImpact(line);
    buckets[bucket].push(toBullet(line, defaultSourceId));
  }

  buckets.market = ensureCount(
    buckets.market,
    2,
    () => toBullet("Cost drivers remain sensitive to energy and macro-index movement.", defaultSourceId),
    5
  );
  buckets.supply = ensureCount(
    buckets.supply,
    2,
    () => toBullet("Supplier capacity and service availability require weekly verification.", defaultSourceId),
    5
  );
  buckets.contracting = ensureCount(
    buckets.contracting,
    2,
    () => toBullet("Commercial terms should be stress-tested for indexation and extension options.", defaultSourceId),
    5
  );
  buckets.risk = ensureCount(
    buckets.risk,
    2,
    () => toBullet("Regulatory and operational constraints remain active planning risks.", defaultSourceId),
    5
  );

  const actionSeed = unique([
    ...(brief.procurementActions ?? []),
    ...(brief.decisionSummary?.doNext ?? []),
    ...(brief.cmSnapshot?.todayPriorities ?? []).map((priority) => priority.title),
    ...(brief.vpSnapshot?.recommendedActions ?? []).map((action) => action.action)
  ]);

  const parseAction = (text: string): BriefReportAction => ({
    action: text,
    rationale: "Tightens execution control against current market and supplier signals.",
    owner: ownerForAction(text),
    expectedOutcome: "Improved sourcing leverage and reduced cost/schedule variance.",
    sourceIds: [defaultSourceId]
  });

  const actions72h = ensureCount(
    actionSeed.slice(0, 3).map(parseAction),
    2,
    () =>
      parseAction(
        "Run supplier check-ins and refresh current quote assumptions for critical spend lines."
      ),
    4
  );
  const actions2to4w = ensureCount(
    actionSeed.slice(3, 7).map(parseAction),
    3,
    () =>
      parseAction(
        "Re-open commercial terms to benchmark indexation, lead-time commitments, and contingency clauses."
      ),
    4
  );
  const actionsQuarter = ensureCount(
    actionSeed.slice(7, 12).map(parseAction),
    3,
    () =>
      parseAction(
        "Advance dual-sourcing and contract resilience planning for the next sourcing cycle."
      ),
    4
  );

  return {
    summaryBullets,
    impactGroups: [
      { label: "Market/Cost drivers", bullets: buckets.market },
      { label: "Supply base & capacity", bullets: buckets.supply },
      { label: "Contracting & commercial terms", bullets: buckets.contracting },
      { label: "Risk & regulatory / operational constraints", bullets: buckets.risk }
    ],
    actionGroups: [
      { horizon: "Next 72 hours", actions: actions72h },
      { horizon: "Next 2-4 weeks", actions: actions2to4w },
      { horizon: "Next quarter", actions: actionsQuarter }
    ]
  };
}

export function hasStructuredBody(brief: BriefPost): boolean {
  const body = (brief.bodyMarkdown ?? "").toLowerCase();
  return body.includes("## summary") && body.includes("## impact") && body.includes("## possible actions") && body.includes("## sources");
}

export function buildStructuredBodyMarkdown(params: {
  title: string;
  region: BriefPost["region"];
  portfolio: string;
  runWindow: string;
  publishedAtISO: string;
  report: BriefReport;
  sources: BriefSource[];
}): string {
  const publishedAt = new Date(params.publishedAtISO).toLocaleString("en-US", {
    timeZone: params.region === "au" ? "Australia/Perth" : "America/Chicago",
    dateStyle: "medium",
    timeStyle: "short",
    hour12: true
  }) + ` ${params.region === "au" ? "AWST" : "CST"}`;
  const numberedSources = params.sources.map((source, index) => ({ ...source, number: index + 1 }));
  const numberBySourceId = new Map(numberedSources.map((source) => [source.sourceId, source.number]));
  const citationTag = (sourceIds: string[]) => {
    const numbers = Array.from(new Set(sourceIds.map((sourceId) => numberBySourceId.get(sourceId)).filter(Boolean)));
    if (numbers.length === 0) return "";
    return numbers.map((value) => `[${value}]`).join("");
  };

  const lines: string[] = [];
  lines.push(`# ${params.title}`);
  lines.push("", `**Region:** ${regionLabel(params.region)}`, `**Portfolio:** ${params.portfolio}`, `**Edition:** ${params.runWindow.toUpperCase()}`);
  lines.push(`**Published:** ${publishedAt}`);

  lines.push("", "## Summary");
  for (const bullet of params.report.summaryBullets) {
    lines.push(`- ${bullet.text} ${citationTag(bullet.sourceIds)}`.trim());
  }

  lines.push("", "## Impact");
  for (const group of params.report.impactGroups) {
    lines.push(`### ${group.label}`);
    for (const bullet of group.bullets) {
      lines.push(`- ${bullet.text} ${citationTag(bullet.sourceIds)}`.trim());
    }
    lines.push("");
  }

  lines.push("## Possible actions");
  for (const group of params.report.actionGroups) {
    lines.push(`### ${group.horizon}`);
    for (const action of group.actions) {
      const refs = citationTag(action.sourceIds);
      lines.push(`- **Action:** ${action.action}`);
      lines.push(`  - **Rationale:** ${action.rationale}`);
      lines.push(`  - **Owner:** ${action.owner}`);
      lines.push(`  - **Expected outcome / KPI:** ${action.expectedOutcome} ${refs}`.trim());
    }
    lines.push("");
  }

  lines.push("## Sources");
  for (const source of numberedSources) {
    let publisher = "";
    try {
      publisher = source.url ? new URL(source.url).hostname.replace(/^www\./, "") : "";
    } catch {
      publisher = "";
    }
    const date = source.publishedAt
      ? new Date(source.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      : "n.d.";
    const titleOrDomain = source.title?.trim() || publisher || source.url;
    lines.push(`${source.number}. ${titleOrDomain} — ${publisher || "Source"} (${date}) — ${source.url}`);
  }

  return lines.join("\n");
}

function toHighlights(report: BriefReport): string[] {
  return report.impactGroups.flatMap((group) => group.bullets.map((bullet) => `${group.label}: ${bullet.text}`)).slice(0, 14);
}

function toActions(report: BriefReport): string[] {
  return report.actionGroups
    .flatMap((group) =>
      group.actions.map(
        (action) =>
          `${group.horizon} — ${action.action}. Rationale: ${action.rationale}. Owner: ${action.owner}. KPI: ${action.expectedOutcome}`
      )
    )
    .slice(0, 12);
}

function toWatchlist(report: BriefReport): string[] {
  const riskGroup = report.impactGroups.find((group) => group.label.toLowerCase().includes("risk"));
  return (riskGroup?.bullets ?? []).map((bullet) => bullet.text).slice(0, 5);
}

export function upgradeBriefToNewFormat(
  brief: BriefPost,
  options?: { titleOverride?: string }
): BriefPost {
  const sources = normalizeUpgradeSources(brief);
  const sourceIds = sources.map((source) => source.sourceId);
  const report = brief.report ?? buildFallbackReport(brief, sourceIds);
  const summary = report.summaryBullets.slice(0, 4).map((bullet) => bullet.text).join(" ");
  const title = options?.titleOverride?.trim() || brief.title;

  return {
    ...brief,
    summary,
    highlights: toHighlights(report),
    procurementActions: toActions(report),
    watchlist: toWatchlist(report),
    report,
    bodyMarkdown: buildStructuredBodyMarkdown({
      title,
      region: brief.region,
      portfolio: brief.portfolio,
      runWindow: brief.runWindow,
      publishedAtISO: brief.publishedAt,
      report,
      sources
    }),
    sources
  };
}
