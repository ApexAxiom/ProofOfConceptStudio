import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const targetPath = path.join(repoRoot, "apps", "web", ".env.production");

const allowedKeys = [
  "AWS_REGION",
  "AWS_SECRET_NAME",
  "SECRETS_CACHE_TTL_MS",
  "DDB_TABLE_NAME",
  "DDB_ENDPOINT",
  "OPENAI_API_KEY",
  "OPENAI_MODEL",
  "OPENAI_BASE_URL",
  "OPENAI_MAX_OUTPUT_TOKENS",
  "OPENAI_REASONING_EFFORT",
  "OPENAI_REASONING_RETRY_MAX_OUTPUT_TOKENS",
  "WEB_SEARCH_ENABLED",
  "CHAT_STATUS_CACHE_MS",
  "CHAT_STATUS_VERIFY",
  "CHAT_STATUS_VERIFY_TIMEOUT_MS",
  "CHAT_FALLBACK_CONTEXT",
  "CHAT_MAX_CLAIMS",
  "CHAT_RATE_LIMIT_DISABLED",
  "CHAT_RATE_LIMIT_RPM",
  "CHAT_RATE_LIMIT_BURST",
  "DEBUG_CHAT_LOGGING",
  "CHAT_ADMIN_USERNAME",
  "CHAT_ADMIN_PASSWORD",
  "ADMIN_TOKEN",
  "AWS_LAMBDA_REGION",
  "RUNNER_LAMBDA_FUNCTION_NAME",
  "RUNNER_DEFAULT_BATCH_COUNT",
  "EXECUTIVE_GOOGLE_NEWS_ENABLED",
  "GOOGLE_NEWS_ENABLED"
];

const lines = [
  "# Generated during the Amplify build for Next.js server-side runtime variables.",
  "# Do not commit this file."
];

let exportedCount = 0;
for (const key of allowedKeys) {
  const value = process.env[key];
  if (!value) continue;
  lines.push(`${key}=${JSON.stringify(value)}`);
  exportedCount += 1;
}

await fs.writeFile(targetPath, `${lines.join("\n")}\n`);

console.log(`Wrote ${exportedCount} Amplify runtime env vars to ${targetPath}`);
