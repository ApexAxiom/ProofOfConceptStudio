import assert from "node:assert/strict";
import { attachEvidenceToBrief } from "./evidence.js";
import type { BriefPost } from "@proof/shared";
import type { ArticleInput } from "../llm/prompts.js";

const articles: ArticleInput[] = [
  {
    title: "Test Article",
    url: "https://example.com/test",
    content: "Steel prices rose 5% this week due to supply constraints in regional mills."
  }
];

const brief: BriefPost = {
  postId: "brief-1",
  title: "Steel prices rise 5% (source: articleIndex 1)",
  region: "au",
  portfolio: "wells-materials-octg",
  runWindow: "apac",
  status: "draft",
  publishedAt: new Date().toISOString(),
  summary: "Steel prices rose 5% this week (source: articleIndex 1)",
  bodyMarkdown: "Body placeholder",
  sources: [],
  marketIndicators: [
    {
      id: "wells-materials-octg-wti",
      label: "WTI Crude",
      url: "https://finance.yahoo.com/quote/CL=F",
      note: "WTI is a key input cost driver for logistics and services."
    }
  ],
  selectedArticles: [
    {
      title: "Test Article",
      url: "https://example.com/test",
      briefContent: "Steel prices rose 5% this week (source: articleIndex 1)",
      sourceIndex: 1
    }
  ]
};

const result = attachEvidenceToBrief({ brief, articles });

assert.ok(result.claims.length > 0, "claims should be generated");
assert.equal(result.claims[0].status, "supported");
assert.ok(result.sources.length === 2, "sources should include selected articles and market indicators");
assert.ok(
  result.sources.some((source) => source.url === "https://example.com/test"),
  "selected article URL must be included in sources"
);
assert.ok(
  result.sources.some((source) => source.url === "https://finance.yahoo.com/quote/CL=F"),
  "market indicator URL must be included in sources"
);

console.log("evidence.smoke passed");
