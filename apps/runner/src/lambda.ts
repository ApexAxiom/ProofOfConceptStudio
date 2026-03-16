import { RegionSlug, RunWindow, runWindowForRegion } from "@proof/shared";
import { loadAgents } from "./agents/config.js";
import { selectAgentIdsForRun } from "./agents/selection.js";
import { initializeSecrets } from "./lib/secrets.js";
import { handleCron, runAgent } from "./run.js";

type RunnerLambdaEvent = {
  action?: "cron" | "run-agent";
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

  const targetRegions = regions ?? ["au", "us-mx-la-lng"];
  const results = [];
  for (const targetRegion of targetRegions) {
    results.push(
      await runCronForRegion({
        region: targetRegion,
        runWindow,
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
    results
  };
}
