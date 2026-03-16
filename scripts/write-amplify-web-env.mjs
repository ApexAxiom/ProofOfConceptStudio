import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const targetPath = path.join(repoRoot, "apps", "web", ".env.production");

const allowedKeys = [
  "API_BASE_URL",
  "AWS_REGION",
  "AWS_SECRET_NAME",
  "SECRETS_CACHE_TTL_MS",
  "CHAT_PROXY_TIMEOUT_MS",
  "CHAT_ADMIN_USERNAME",
  "CHAT_ADMIN_PASSWORD",
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

if (!process.env.API_BASE_URL) {
  console.warn("API_BASE_URL is not set; web API proxy routes will fall back to localhost.");
}

console.log(`Wrote ${exportedCount} Amplify runtime env vars to ${targetPath}`);
