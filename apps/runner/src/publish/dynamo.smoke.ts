import assert from "node:assert";
import { BriefPost } from "@proof/shared";
import { buildDynamoItem } from "./dynamo.js";
import { IngestResult } from "../ingest/fetch.js";

const brief: BriefPost = {
  postId: "post-1",
  title: "Brief",
  region: "au",
  portfolio: "drilling-services",
  runWindow: "apac",
  status: "published",
  publishedAt: "2024-01-01T00:00:00Z",
  bodyMarkdown: "Body",
  summary: "Summary",
  sources: ["https://example.com/source"],
  selectedArticles: [
    {
      title: "Article",
      url: "https://example.com/article",
      briefContent: "Content",
      categoryImportance: "Why",
      keyMetrics: ["10%"],
      imageUrl: "https://example.com/image.jpg",
      imageAlt: "Alt",
      sourceName: "Source",
      publishedAt: "2023-12-31T00:00:00Z"
    }
  ]
};

const ingestResult: IngestResult = {
  articles: [],
  scannedSources: ["https://feed.example.com"],
  metrics: { collectedCount: 1, extractedCount: 1, dedupedCount: 1 }
};

const item = buildDynamoItem(brief, ingestResult, "run-123");
const stored = item.selectedArticles?.[0];

assert.strictEqual(stored?.categoryImportance, "Why");
assert.deepStrictEqual(stored?.keyMetrics, ["10%"]);
assert.strictEqual(stored?.publishedAt, "2023-12-31T00:00:00Z");
assert.strictEqual(stored?.sourceName, "Source");
assert.strictEqual(item.PK, "POST#post-1");

console.log("dynamo.smoke passed");
