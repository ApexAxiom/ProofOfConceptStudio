import { handleCron } from "./run.js";
import { initializeSecrets } from "./lib/secrets.js";
import { REGIONS, RegionSlug, RunWindow, runWindowForRegion } from "@proof/shared";

async function main() {
  // Load secrets from AWS Secrets Manager before running
  await initializeSecrets();

  const [, , runWindowArg, ...restArgs] = process.argv;
  const runWindow: RunWindow = runWindowArg === "international" ? "international" : "apac";
  const dryRun = restArgs.includes("--dry-run");
  const runDateFlagIndex = restArgs.findIndex((arg) => arg === "--run-date");
  const runDate = runDateFlagIndex >= 0 ? restArgs[runDateFlagIndex + 1] : undefined;
  const regions = (Object.keys(REGIONS) as RegionSlug[]).filter((region) => runWindowForRegion(region) === runWindow);
  try {
    await handleCron(runWindow, { dryRun, runDate, regions });
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
