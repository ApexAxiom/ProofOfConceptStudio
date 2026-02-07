import { handleCron } from "./run.js";
import { initializeSecrets } from "./lib/secrets.js";
import { RunWindow } from "@proof/shared";

async function main() {
  // Load secrets from AWS Secrets Manager before running
  await initializeSecrets();

  const [, , runWindowArg, ...restArgs] = process.argv;
  const runWindow = (runWindowArg as RunWindow) || "apac";
  const dryRun = restArgs.includes("--dry-run");
  const runDateFlagIndex = restArgs.findIndex((arg) => arg === "--run-date");
  const runDate = runDateFlagIndex >= 0 ? restArgs[runDateFlagIndex + 1] : undefined;
  try {
    await handleCron(runWindow, { dryRun, runDate });
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
