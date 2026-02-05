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
    ? "First-time baseline brief: awaiting the first successful content generation for this portfolio/region."
    : options.reason === "no-updates"
      ? "No material change detected today. A carry-forward baseline was published."
      : "Brief generation failed; a fallback baseline was published while the system retries.";

  const sourceLines =
    sourceHints.length > 0
      ? sourceHints.map((source) => `- ${source.title}: ${source.url}`).join("\n")
      : "- No source endpoints are currently configured.";

  return {
    postId: crypto.randomUUID(),
    title: `${options.agent.label} — Daily Brief`,
    region: options.region,
    portfolio: options.agent.portfolio,
    agentId: options.agent.id,
    runWindow: options.runWindow,
    status: "published",
    generationStatus: options.reason,
    publishedAt,
    briefDay,
    summary: statusLine,
    bodyMarkdown: `# ${options.agent.label}\n\n${statusLine}\n\n## Sources monitored\n${sourceLines}\n\n_Check back later for updates._`,
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
      : "Brief generation failed. Carrying forward the most recent brief.";

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
