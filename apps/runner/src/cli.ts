import { handleCron } from "./run.js";
import { RunWindow } from "@proof/shared";

async function main() {
  const [, , runWindowArg] = process.argv;
  const runWindow = (runWindowArg as RunWindow) || "am";
  try {
    await handleCron(runWindow);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
