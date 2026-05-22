import assert from "node:assert/strict";

const DEFAULT_BASE_URL = "https://proofofconceptstudio.com";
const MAX_BRIEF_AGE_MS = 36 * 60 * 60 * 1000;

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/$/, "");
}

function extractBriefDayMatches(html: string): Date[] {
  const matches = Array.from(html.matchAll(/brief_([0-9]{4}-[0-9]{2}-[0-9]{2})(?:%23|#)/g));
  return matches
    .map((match) => new Date(`${match[1]}T12:00:00.000Z`))
    .filter((date) => Number.isFinite(date.getTime()));
}

async function main() {
  const baseUrl = normalizeBaseUrl(process.env.WEB_BASE_URL ?? DEFAULT_BASE_URL);
  const response = await fetch(baseUrl, {
    headers: {
      "Cache-Control": "no-cache"
    }
  });

  assert.equal(response.status, 200, `${baseUrl} should return 200`);

  const html = await response.text();
  assert.match(html, /Top 10 Latest Briefs/, "homepage should include the latest briefs section");

  const briefDays = extractBriefDayMatches(html);
  assert.ok(briefDays.length > 0, "homepage should include latest brief links");

  const latestBriefDayMs = Math.max(...briefDays.map((date) => date.getTime()));
  assert.ok(Date.now() - latestBriefDayMs <= MAX_BRIEF_AGE_MS, "homepage latest briefs should include a brief from the last 36 hours");

  console.log("page.production.smoke passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
