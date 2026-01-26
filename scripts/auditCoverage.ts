#!/usr/bin/env node
import { REGIONS, RegionSlug, getBriefDayKey } from "@proof/shared";
import { auditCoverage } from "../apps/runner/src/brief-coverage/audit.js";

function getArgValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function requireRegion(input?: string): RegionSlug {
  const region = input as RegionSlug;
  if (!region || !REGIONS[region]) {
    throw new Error(`Invalid or missing region. Use one of: ${Object.keys(REGIONS).join(", ")}`);
  }
  return region;
}

function normalizeDayKey(region: RegionSlug, input?: string): string {
  if (!input) return getBriefDayKey(region, new Date());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    throw new Error(`Invalid date format: ${input}. Use YYYY-MM-DD.`);
  }
  return input;
}

async function main() {
  const region = requireRegion(getArgValue("--region"));
  const dayKey = normalizeDayKey(region, getArgValue("--date"));

  const coverage = await auditCoverage({ regions: [region], dayKey });
  const missing = coverage.missingAgents;

  console.log(`Coverage audit for ${region} on ${dayKey}`);
  console.log(`Expected agents: ${coverage.expectedAgents.length}`);
  console.log(`Published briefs: ${coverage.publishedBriefs.length}`);

  if (missing.length === 0) {
    console.log("✅ Coverage OK - no missing agents.");
    return;
  }

  console.log(`⚠️ Missing agents (${missing.length}):`);
  for (const agent of missing) {
    console.log(`- ${agent.label} (${agent.agentId})`);
  }

  process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
