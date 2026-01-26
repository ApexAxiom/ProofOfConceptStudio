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
