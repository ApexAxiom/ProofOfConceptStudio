import { AgentConfig, BriefPost, RegionSlug, RunWindow, isPlaceholdersAllowed, isUserVisiblePlaceholderBrief } from "@proof/shared";
import { PlaceholderReason, buildCarryForwardBrief, buildPlaceholderBrief } from "./placeholders.js";

/**
 * A carry-forward brief has real content inherited from a previous published brief,
 * so it's safe to use as a base for another carry-forward. Only reject briefs that
 * are pure synthetic placeholders (baseline/system-generated with no real articles).
 */
function hasRealContent(brief: BriefPost): boolean {
  const tags = (brief.tags ?? []).map((t) => t.toLowerCase());
  if (tags.includes("carry-forward")) return true;
  if (brief.generationStatus === "published") return true;
  const hasBody = (brief.bodyMarkdown ?? "").length > 300;
  const hasArticles = (brief.selectedArticles ?? []).length > 0;
  return hasBody && hasArticles;
}

export function resolveFallbackBrief(options: {
  agent: AgentConfig;
  region: RegionSlug;
  runWindow: RunWindow;
  reason: PlaceholderReason;
  previousBrief?: BriefPost | null;
  now?: Date;
}): BriefPost | null {
  // Production intelligence policy: never publish synthetic/carry-forward briefs.
  // If a run has no new signal, we surface that state in status/monitoring instead.
  if (!isPlaceholdersAllowed()) return null;

  if (options.previousBrief && (!isUserVisiblePlaceholderBrief(options.previousBrief) || hasRealContent(options.previousBrief))) {
    return buildCarryForwardBrief({
      agent: options.agent,
      region: options.region,
      runWindow: options.runWindow,
      reason: options.reason,
      previousBrief: options.previousBrief,
      now: options.now
    });
  }

  return buildPlaceholderBrief({
    agent: options.agent,
    region: options.region,
    runWindow: options.runWindow,
    reason: options.reason,
    baseline: true,
    now: options.now
  });
}
