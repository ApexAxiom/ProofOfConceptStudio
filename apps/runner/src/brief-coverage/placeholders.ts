import crypto from "node:crypto";
import { AgentConfig, BriefPost, RegionSlug, RunWindow, buildSourceId, getBriefDayKey } from "@proof/shared";

export type PlaceholderReason = "no-updates" | "generation-failed";

/**
 * Builds a placeholder brief when generation fails or no updates are available.
 */
export function buildPlaceholderBrief(options: {
  agent: AgentConfig;
  region: RegionSlug;
  runWindow: RunWindow;
  reason: PlaceholderReason;
  baseline?: boolean;
  now?: Date;
}): BriefPost {
  const now = options.now ?? new Date();
  const publishedAt = now.toISOString();
  const briefDay = getBriefDayKey(options.region, now);
  const sourceHints = Array.from(
    new Map(
      (options.agent.feedsByRegion[options.region] ?? []).map((feed) => [
        feed.url,
        {
          sourceId: buildSourceId(feed.url),
          title: feed.name,
          url: feed.url,
          retrievedAt: publishedAt
        }
      ])
    ).values()
  ).slice(0, 8);

  const statusLine = options.baseline
    ? "Baseline coverage is active while the first full intelligence cycle initializes for this portfolio/region."
    : options.reason === "no-updates"
      ? "No material change detected today. Carry-forward baseline remains in effect."
      : "Automated refresh was unavailable in this cycle. Baseline coverage remains active.";

  const title = options.baseline
    ? `${options.agent.label} baseline coverage activated for today's cycle`
    : options.reason === "no-updates"
      ? `${options.agent.label} conditions hold steady with no material change`
      : `${options.agent.label} baseline maintained during temporary refresh outage`;

  const sourceLines =
    sourceHints.length > 0
      ? sourceHints.map((source) => `- ${source.title}: ${source.url}`).join("\n")
      : "- No source endpoints are currently configured.";

  return {
    postId: crypto.randomUUID(),
    title,
    region: options.region,
    portfolio: options.agent.portfolio,
    agentId: options.agent.id,
    runWindow: options.runWindow,
    status: "published",
    generationStatus: options.reason,
    publishedAt,
    briefDay,
    summary: statusLine,
    bodyMarkdown: `# ${title}

## Summary
- ${statusLine}

## Impact
- Market/Cost drivers: Core category exposure is unchanged until new signals are confirmed.
- Supply base & capacity: Supplier and market scans continue on the configured source set.
- Contracting & commercial terms: Existing assumptions remain in force for this cycle.
- Risk & regulatory / operational constraints: Monitoring remains active for new constraints and shifts.

## Possible actions
- Next 72 hours: Review monitored sources for newly published material and critical updates.
- Next 2-4 weeks: Validate if baseline assumptions still hold against new supplier and market data.
- Next quarter: Maintain contingency options until full refresh cadence stabilizes.

## Sources
${sourceLines}
`,
    sources: sourceHints,
    selectedArticles: [],
    tags: [
      "system-placeholder",
      options.reason,
      ...(options.baseline ? ["baseline"] : [])
    ]
  };
}

/**
 * Builds a carry-forward brief using the most recent published content.
 */
export function buildCarryForwardBrief(options: {
  agent: AgentConfig;
  region: RegionSlug;
  runWindow: RunWindow;
  reason: PlaceholderReason;
  previousBrief: BriefPost;
  now?: Date;
}): BriefPost {
  const now = options.now ?? new Date();
  const publishedAt = now.toISOString();
  const briefDay = getBriefDayKey(options.region, now);
  const statusLine =
    options.reason === "no-updates"
      ? "No material change detected today. Carrying forward the most recent brief."
      : "Automated refresh was unavailable this cycle. Carrying forward the most recent brief.";

  const baseSummary = options.previousBrief.summary?.trim();
  const summary = baseSummary ? `${statusLine} ${baseSummary}` : statusLine;

  return {
    ...options.previousBrief,
    postId: crypto.randomUUID(),
    region: options.region,
    portfolio: options.agent.portfolio,
    agentId: options.agent.id,
    runWindow: options.runWindow,
    status: "published",
    generationStatus: options.reason,
    publishedAt,
    briefDay,
    summary,
    bodyMarkdown: `> ${statusLine}\n\n${options.previousBrief.bodyMarkdown}`,
    tags: Array.from(new Set([...(options.previousBrief.tags ?? []), "carry-forward", options.reason]))
  };
}
