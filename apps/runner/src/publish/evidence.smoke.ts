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
assert.ok(result.sources.length === 1, "sources should be populated from evidence");

console.log("evidence.smoke passed");
