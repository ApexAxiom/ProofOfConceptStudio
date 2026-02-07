import crypto from "node:crypto";
import { RegionSlug, runWindowForRegion } from "@proof/shared";
import { loadAgents } from "../agents/config.js";
import { auditCoverage } from "./audit.js";
import { expectedCoverageDayKey } from "./day.js";
import { getLatestPublishedBrief } from "../db/previous-brief.js";
import { resolveFallbackBrief } from "./fallback.js";
import { publishBrief, logRunResult } from "../publish/dynamo.js";

function parseRegions(argv: string[]): RegionSlug[] {
  const token = argv.find((arg) => arg.startsWith("--regions="));
  if (!token) return ["au", "us-mx-la-lng"];
  const requested = token.slice("--regions=".length).split(",").map((item) => item.trim()) as RegionSlug[];
  const allowed = new Set<RegionSlug>(["au", "us-mx-la-lng"]);
  const filtered = requested.filter((region) => allowed.has(region));
  return filtered.length > 0 ? filtered : ["au", "us-mx-la-lng"];
}

async function main() {
  const regions = parseRegions(process.argv.slice(2));
  const dryRun = process.argv.includes("--dry-run");
  const runId = crypto.randomUUID();
  const now = new Date();
  const agents = loadAgents();
  const ingestStub = {
    articles: [],
    scannedSources: [],
    metrics: { collectedCount: 0, dedupedCount: 0, extractedCount: 0 }
  };

  let published = 0;
  let missing = 0;
  let skipped = 0;

  for (const region of regions) {
    const dayKey = expectedCoverageDayKey(region, now);
    const coverage = await auditCoverage({ regions: [region], dayKey });
    missing += coverage.missingAgents.length;

    for (const gap of coverage.missingAgents) {
      const agent = agents.find((candidate) => candidate.id === gap.agentId);
      if (!agent) continue;
      const previousBrief = await getLatestPublishedBrief({
        portfolio: agent.portfolio,
        region: gap.region,
        beforeIso: now.toISOString()
      });
      const fallback = resolveFallbackBrief({
        agent,
        region: gap.region,
        runWindow: runWindowForRegion(gap.region),
        reason: previousBrief ? "no-updates" : "generation-failed",
        previousBrief,
        now
      });
      if (!fallback) {
        skipped += 1;
        console.warn(
          JSON.stringify({
            level: "warn",
            event: "coverage_fill_skipped",
            reasonCode: "placeholder_suppressed",
            runId,
            region: gap.region,
            portfolio: agent.portfolio,
            agentId: agent.id,
            runWindow: runWindowForRegion(gap.region),
            runDate: now.toISOString()
          })
        );
        continue;
      }

      if (!dryRun) {
        await publishBrief(fallback, ingestStub, runId);
        await logRunResult(runId, agent.id, region, "published");
      }
      published += 1;
    }
  }

  console.log(
    JSON.stringify(
      {
        command: "coverage:fill",
        dryRun,
        regions,
        missing,
        published,
        skipped
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
