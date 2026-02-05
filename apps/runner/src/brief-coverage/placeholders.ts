import crypto from "node:crypto";
import { AgentConfig, BriefPost, RegionSlug, RunWindow, getBriefDayKey } from "@proof/shared";

export type PlaceholderReason = "no-updates" | "generation-failed";

/**
 * Builds a placeholder brief when generation fails or no updates are available.
 */
export function buildPlaceholderBrief(options: {
  agent: AgentConfig;
  region: RegionSlug;
  runWindow: RunWindow;
  reason: PlaceholderReason;
  now?: Date;
}): BriefPost {
  const now = options.now ?? new Date();
  const publishedAt = now.toISOString();
  const briefDay = getBriefDayKey(options.region, now);
  const statusLine =
    options.reason === "no-updates"
      ? "No updates were found for this category today."
      : "Brief generation failed; the system will retry.";

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
    bodyMarkdown: `# ${options.agent.label}\n\n${statusLine}\n\n_Check back later for updates._`,
    sources: [],
    selectedArticles: [],
    tags: ["system-placeholder", options.reason]
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
      ? "No new updates today. Carrying forward the most recent brief."
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
