import {
  BriefCitedBullet,
  BriefPost,
  BriefReport,
  BriefReportAction,
  BriefSource,
  buildSourceId,
  normalizeBriefSources,
  regionLabel
} from "@proof/shared";
import { renderProcurementReportMarkdown } from "../llm/render.js";
import { DynamoBriefItem, fetchPublishedBriefItems, putBriefItem } from "./shared.js";
import { buildHeadlineTitle, isGenericBriefTitle } from "./title-utils.js";

function parseArg(name: string): string | undefined {
  const hit = process.argv.find((arg) => arg.startsWith(`${name}=`));
  return hit ? hit.slice(name.length + 1) : undefined;
}

function asPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function splitIntoSentences(text: string): string[] {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\[[^\]]+\]\([^)]+\)/g, " ")
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 20);
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function toBullet(text: string, defaultSourceId: string): BriefCitedBullet {
  return {
    text: text.replace(/\s+/g, " ").trim(),
    sourceIds: [defaultSourceId]
  };
}

function normalizeSources(brief: BriefPost): BriefSource[] {
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

function buildFallbackReport(brief: BriefPost, sourceIds: string[]): BriefReport {
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

function hasStructuredBody(brief: BriefPost): boolean {
  const body = (brief.bodyMarkdown ?? "").toLowerCase();
  return body.includes("## summary") && body.includes("## impact") && body.includes("## possible actions") && body.includes("## sources");
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

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const force = process.argv.includes("--force");
  const limit = asPositiveInt(parseArg("--limit"), 1000);
  const regionArg = parseArg("--region");
  const region = regionArg === "au" || regionArg === "us-mx-la-lng" ? regionArg : undefined;
  const items = await fetchPublishedBriefItems({ limit, region: region as any });

  let scanned = 0;
  let updated = 0;
  let skippedStructured = 0;

  for (const item of items) {
    scanned += 1;
    const brief = item as BriefPost;
    if (!force && brief.report && hasStructuredBody(brief)) {
      skippedStructured += 1;
      continue;
    }

    const sources = normalizeSources(brief);
    const sourceIds = sources.map((source) => source.sourceId);
    const report = buildFallbackReport(brief, sourceIds);
    const title = isGenericBriefTitle(brief.title, brief.portfolio) ? buildHeadlineTitle(brief) : brief.title;
    const summary = report.summaryBullets.slice(0, 4).map((bullet) => bullet.text).join(" ");
    const highlights = toHighlights(report);
    const procurementActions = toActions(report);
    const watchlist = toWatchlist(report);
    const bodyMarkdown = renderProcurementReportMarkdown({
      title,
      regionLabel: regionLabel(brief.region),
      portfolioLabel: brief.portfolio,
      runWindow: brief.runWindow,
      publishedAtISO: brief.publishedAt,
      region: brief.region,
      report,
      sources
    });

    updated += 1;

    if (!dryRun) {
      await putBriefItem({
        ...(item as DynamoBriefItem),
        title,
        summary,
        highlights,
        procurementActions,
        watchlist,
        report,
        bodyMarkdown
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        command: "backfill:brief-upgrade",
        dryRun,
        force,
        scanned,
        updated,
        skippedStructured,
        region: region ?? "all"
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
