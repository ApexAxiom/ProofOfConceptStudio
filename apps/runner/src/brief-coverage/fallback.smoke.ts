import assert from "node:assert/strict";
import { AgentConfig, BriefPost } from "@proof/shared";
import { resolveFallbackBrief } from "./fallback.js";

const agent: AgentConfig = {
  id: "drilling-services",
  portfolio: "drilling-services",
  label: "Drilling Services",
  description: "Test agent",
  maxArticlesToConsider: 20,
  articlesPerRun: 3,
  lookbackDays: 3,
  feedsByRegion: {
    au: [{ name: "Test Feed", url: "https://example.com/rss", type: "rss" }],
    "us-mx-la-lng": [{ name: "Test Feed", url: "https://example.com/rss", type: "rss" }]
  }
};

const previousBrief: BriefPost = {
  postId: "prev",
  title: "Previous",
  region: "au",
  portfolio: "drilling-services",
  runWindow: "apac",
  status: "published",
  publishedAt: "2026-02-04T00:00:00.000Z",
  summary: "Previous summary",
  bodyMarkdown: "Previous markdown",
  sources: ["https://www.reuters.com/world/energy/market-update-2026-02-04/"],
  tags: ["published"]
};

const carryForward = resolveFallbackBrief({
  agent,
  region: "au",
  runWindow: "apac",
  reason: "no-updates",
  previousBrief
});

assert.ok(carryForward);
assert.equal(carryForward.portfolio, previousBrief.portfolio);
assert.equal(carryForward.generationStatus, "no-updates");
assert.equal(carryForward.summary, previousBrief.summary);
assert.ok(carryForward.tags?.includes("carry-forward"));

const baseline = resolveFallbackBrief({
  agent,
  region: "au",
  runWindow: "apac",
  reason: "generation-failed",
  previousBrief: null
});

assert.ok(baseline);
assert.equal(baseline.generationStatus, "generation-failed");
assert.ok(baseline.summary?.toLowerCase().includes("coverage is active"));
assert.ok((baseline.sources ?? []).length > 0);
assert.ok(baseline.tags?.includes("baseline"));

const originalNodeEnv = process.env.NODE_ENV;
const originalPlaceholderFlag = process.env.PLACEHOLDER_CONTENT_ENABLED;
const originalAllowFlag = process.env.ALLOW_PLACEHOLDER_CONTENT;
process.env.NODE_ENV = "production";
delete process.env.PLACEHOLDER_CONTENT_ENABLED;
delete process.env.ALLOW_PLACEHOLDER_CONTENT;

const prodBaseline = resolveFallbackBrief({
  agent,
  region: "au",
  runWindow: "apac",
  reason: "generation-failed",
  previousBrief: null
});
assert.equal(prodBaseline, null);

process.env.NODE_ENV = originalNodeEnv;
if (originalPlaceholderFlag === undefined) {
  delete process.env.PLACEHOLDER_CONTENT_ENABLED;
} else {
  process.env.PLACEHOLDER_CONTENT_ENABLED = originalPlaceholderFlag;
}
if (originalAllowFlag === undefined) {
  delete process.env.ALLOW_PLACEHOLDER_CONTENT;
} else {
  process.env.ALLOW_PLACEHOLDER_CONTENT = originalAllowFlag;
}

console.log("fallback.smoke passed");
