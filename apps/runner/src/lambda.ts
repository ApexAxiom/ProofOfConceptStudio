import { RegionSlug, RunWindow, runWindowForRegion } from "@proof/shared";
import { loadAgents } from "./agents/config.js";
import { selectAgentIdsForRun } from "./agents/selection.js";
import { initializeSecrets } from "./lib/secrets.js";
import { handleCron, runAgent } from "./run.js";
import { evaluateScheduledRunGuard } from "./schedule-guard.js";
import { emitScheduledRunHealth } from "./scheduled-health.js";

type RunnerLambdaEvent = {
  action?: "cron" | "run-agent" | "scheduled-health";
  region?: RegionSlug;
  regions?: RegionSlug[];
  runWindow?: RunWindow;
  agentId?: string;
  agentIds?: string[];
  batchIndex?: number;
  batchCount?: number;
  dryRun?: boolean;
  runDate?: string;
  runId?: string;
  scheduled?: boolean;
  force?: boolean;
};

function normalizeRegion(value: unknown): RegionSlug | undefined {
  return value === "au" || value === "us-mx-la-lng" ? value : undefined;
}

function normalizeRegions(values: unknown): RegionSlug[] | undefined {
  if (!Array.isArray(values)) return undefined;
  const regions = values.map(normalizeRegion).filter((value): value is RegionSlug => Boolean(value));
  return regions.length ? regions : undefined;
}

async function runCronForRegion(params: {
  region: RegionSlug;
  runWindow?: RunWindow;
  agentIds?: string[];
  batchIndex?: number;
  batchCount?: number;
  dryRun?: boolean;
  runDate?: string;
  runId?: string;
  scheduled?: boolean;
}) {
  const allAgentIds = loadAgents().map((agent) => agent.id);
  const selection = selectAgentIdsForRun({
    agentIds: params.agentIds,
    batchIndex: typeof params.batchIndex === "number" ? params.batchIndex : undefined,
    batchCount: typeof params.batchCount === "number" ? params.batchCount : undefined,
    allAgentIds
  });
  const runWindow = params.runWindow ?? runWindowForRegion(params.region);
  const result = await handleCron(runWindow, {
    runId: params.runId,
    scheduled: params.scheduled === true,
    regions: [params.region],
    agentIds: selection.agentIds,
    dryRun: params.dryRun,
    runDate: params.runDate
  });

  return {
    region: params.region,
    runWindow,
    selection,
    result
  };
}

export async function handler(event: RunnerLambdaEvent = {}) {
  await initializeSecrets();

  const region = normalizeRegion(event.region);
  const regions = normalizeRegions(event.regions) ?? (region ? [region] : undefined);
  const runWindow = event.runWindow;

  if (event.action === "run-agent") {
    if (!event.agentId || !region) {
      throw new Error("run-agent requires agentId and region");
    }

    const result = await runAgent(event.agentId, region, runWindow ?? runWindowForRegion(region), {
      runId: event.runId,
      dryRun: event.dryRun,
      runDate: event.runDate
    });

    return {
      ok: result.ok,
      action: "run-agent",
      region,
      runWindow: runWindow ?? runWindowForRegion(region),
      result
    };
  }

  if (event.action === "scheduled-health") {
    const targetRegions = regions ?? ["au", "us-mx-la-lng"];
    const now = event.runDate ? new Date(event.runDate) : new Date();
    if (Number.isNaN(now.getTime())) {
      throw new Error(`Invalid runDate provided: ${event.runDate}`);
    }
    const results = [];
    for (const targetRegion of targetRegions) {
      results.push(
        await emitScheduledRunHealth({
          region: targetRegion,
          runWindow: runWindow ?? runWindowForRegion(targetRegion),
          now
        })
      );
    }
    return {
      ok: results.every((result) => result.ok),
      action: "scheduled-health",
      results
    };
  }

  const targetRegions = regions ?? ["au", "us-mx-la-lng"];
  const results = [];
  const skipped = [];
  const now = new Date();
  for (const targetRegion of targetRegions) {
    const targetRunWindow = runWindow ?? runWindowForRegion(targetRegion);
    const guard = evaluateScheduledRunGuard({
      scheduled: event.scheduled === true,
      force: event.force === true,
      dryRun: event.dryRun === true,
      runWindow: targetRunWindow,
      now
    });
    if (guard.skipped) {
      skipped.push({
        region: targetRegion,
        runWindow: targetRunWindow,
        skipped: true,
        reason: guard.reason,
        localWeekday: guard.localWeekday
      });
      continue;
    }
    results.push(
      await runCronForRegion({
        region: targetRegion,
        runWindow: targetRunWindow,
        agentIds: event.agentIds,
        batchIndex: event.batchIndex,
        batchCount: event.batchCount,
        dryRun: event.dryRun,
        runDate: event.runDate,
        runId: event.runId,
        scheduled: event.scheduled
      })
    );
  }

  return {
    ok: results.every((item) => item.result.ok),
    action: "cron",
    skipped,
    results
  };
}
