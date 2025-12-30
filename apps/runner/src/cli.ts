import { handleCron } from "./run.js";
import { initializeSecrets } from "./lib/secrets.js";
import { RunWindow } from "@proof/shared";

async function main() {
  // Load secrets from AWS Secrets Manager before running
  await initializeSecrets();

  const [, , runWindowArg] = process.argv;
  const runWindow = (runWindowArg as RunWindow) || "apac";
  try {
    await handleCron(runWindow);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
