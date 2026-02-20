import assert from "node:assert/strict";
import { AgentConfig, BriefPost } from "@proof/shared";
import { resolveFallbackBrief } from "./fallback.js";
import { buildDynamoItem } from "../publish/dynamo.js";

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
const ORIGINAL_PLACEHOLDER_FLAG = process.env.PLACEHOLDER_CONTENT_ENABLED;
const ORIGINAL_ALLOW_FLAG = process.env.ALLOW_PLACEHOLDER_CONTENT;

// Placeholders are expected to be available in smoke tests.
if (!process.env.NODE_ENV) process.env.NODE_ENV = "test";

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
assert.equal(carryForward.generationStatus, "published");
assert.equal(carryForward.summary, previousBrief.summary);
assert.ok(carryForward.tags?.includes("carry-forward"));

// Carry-forward briefs come from Dynamo reads in production. Ensure we never allow
// legacy DynamoDB key/index attributes to override the computed ones on publish.
const carryForwardWithLeakedKeys = {
  ...(carryForward as any),
  PK: "POST#evil",
  SK: "DAY#evil",
  GSI1PK: "PORTFOLIO#evil",
  GSI1SK: "DATE#evil",
  GSI2PK: "REGION#evil",
  GSI2SK: "DATE#evil",
  GSI3PK: "STATUS#evil",
  GSI3SK: "DATE#evil",
} as any;
const built = buildDynamoItem(
  carryForwardWithLeakedKeys as any,
  { articles: [], scannedSources: ["https://example.com/rss"], metrics: { collectedCount: 0, dedupedCount: 0, extractedCount: 0 } } as any,
  "run-test"
);
assert.equal(built.PK, `POST#${carryForward.postId}`);
assert.notEqual(built.PK, "POST#evil");
assert.equal(built.GSI1PK, `PORTFOLIO#${carryForward.portfolio}`);
assert.equal(built.GSI2PK, `REGION#${carryForward.region}`);

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

process.env.NODE_ENV = "production";
delete process.env.PLACEHOLDER_CONTENT_ENABLED;
delete process.env.ALLOW_PLACEHOLDER_CONTENT;

const prodCarryForward = resolveFallbackBrief({
  agent,
  region: "au",
  runWindow: "apac",
  reason: "no-updates",
  previousBrief
});
assert.ok(prodCarryForward, "Production should still return carry-forward when prior real brief exists");
assert.equal(prodCarryForward.generationStatus, "published");
assert.equal(prodCarryForward.summary, previousBrief.summary);
assert.ok(prodCarryForward.tags?.includes("carry-forward"));

const prodBaseline = resolveFallbackBrief({
  agent,
  region: "au",
  runWindow: "apac",
  reason: "generation-failed",
  previousBrief: null
});
assert.equal(prodBaseline, null);

process.env.NODE_ENV = ORIGINAL_NODE_ENV;
if (ORIGINAL_PLACEHOLDER_FLAG === undefined) {
  delete process.env.PLACEHOLDER_CONTENT_ENABLED;
} else {
  process.env.PLACEHOLDER_CONTENT_ENABLED = ORIGINAL_PLACEHOLDER_FLAG;
}
if (ORIGINAL_ALLOW_FLAG === undefined) {
  delete process.env.ALLOW_PLACEHOLDER_CONTENT;
} else {
  process.env.ALLOW_PLACEHOLDER_CONTENT = ORIGINAL_ALLOW_FLAG;
}

console.log("fallback.smoke passed");
