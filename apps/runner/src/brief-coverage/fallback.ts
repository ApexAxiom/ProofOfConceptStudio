import { AgentConfig, BriefPost, RegionSlug, RunWindow } from "@proof/shared";
import { PlaceholderReason, buildCarryForwardBrief, buildPlaceholderBrief } from "./placeholders.js";

export function resolveFallbackBrief(options: {
  agent: AgentConfig;
  region: RegionSlug;
  runWindow: RunWindow;
  reason: PlaceholderReason;
  previousBrief?: BriefPost | null;
  now?: Date;
}): BriefPost {
  if (options.previousBrief) {
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

