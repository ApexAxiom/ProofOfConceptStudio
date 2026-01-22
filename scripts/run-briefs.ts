#!/usr/bin/env node
/**
 * Trigger a brief run via the Admin API.
 *
 * Uses the same API as the chat function. Set:
 *   - API_BASE_URL: deployed API service URL (e.g. your API App Runner URL)
 *   - ADMIN_TOKEN: your admin token (from AWS Secrets Manager or env)
 *
 * Usage:
 *   API_BASE_URL=https://your-api.awsapprunner.com ADMIN_TOKEN=your-token pnpm run run-briefs
 *   # Or both regions (default):
 *   API_BASE_URL=... ADMIN_TOKEN=... pnpm run run-briefs all
 *
 * Options:
 *   all | both  - Run APAC + International (au, us-mx-la-lng) [default]
 *   au | apac   - Run APAC only
 *   us | intl   - Run International only
 */

const API_BASE_URL = process.env.API_BASE_URL ?? "";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? "";

async function main() {
  const arg = (process.argv[2] ?? "all").toLowerCase();

  if (!API_BASE_URL || !ADMIN_TOKEN) {
    console.error("Set API_BASE_URL and ADMIN_TOKEN in the environment.");
    console.error("Example: API_BASE_URL=https://your-api.awsapprunner.com ADMIN_TOKEN=xxx pnpm run run-briefs");
    process.exit(1);
  }

  const base = API_BASE_URL.replace(/\/$/, "");
  let payload: { regions?: string[]; region?: string; runWindow?: string; force: boolean };

  if (arg === "all" || arg === "both") {
    payload = { regions: ["au", "us-mx-la-lng"], force: true };
  } else if (arg === "au" || arg === "apac") {
    payload = { region: "au", runWindow: "apac", force: true };
  } else if (arg === "us" || arg === "intl") {
    payload = { region: "us-mx-la-lng", runWindow: "international", force: true };
  } else {
    console.error("Usage: run-briefs [all|au|us]. Default: all");
    process.exit(1);
  }

  console.log("Triggering brief run:", JSON.stringify(payload, null, 2));
  const res = await fetch(`${base}/admin/run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-token": ADMIN_TOKEN
    },
    body: JSON.stringify(payload)
  });

  const json = await res.json();
  if (!res.ok) {
    console.error("Error:", res.status, json);
    process.exit(1);
  }
  console.log("Response:", JSON.stringify(json, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
