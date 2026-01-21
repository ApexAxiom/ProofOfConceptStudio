import assert from "node:assert";
import { BriefPost } from "@proof/shared";
import { validateNumericClaims } from "./factuality.js";
import type { ArticleInput } from "../llm/prompts.js";

const articles: ArticleInput[] = [
  { title: "Alpha", url: "https://example.com/a", content: "Costs increased 8% year over year." },
  { title: "Beta", url: "https://example.com/b", content: "No numeric data in this update." }
];

const brief: BriefPost = {
  postId: "brief-1",
  title: "Brief",
  region: "au",
  portfolio: "drilling-services",
  runWindow: "apac",
  status: "draft",
  publishedAt: "2024-01-01T00:00:00Z",
  bodyMarkdown: "Body",
  summary: "Summary (analysis)",
  sources: ["https://example.com/a"],
  highlights: ["Costs increased 12% (source: articleIndex 2)"],
  procurementActions: [],
  watchlist: [],
  deltaSinceLastRun: [],
  marketIndicators: [],
  selectedArticles: [
    {
      title: "Alpha",
      url: "https://example.com/a",
      briefContent: "Costs increased 8% (source: articleIndex 1)",
      categoryImportance: "Why it matters (analysis)",
      keyMetrics: ["8% (source: articleIndex 1)"],
      sourceIndex: 1
    }
  ]
};

const issues = validateNumericClaims(brief, articles);

assert.ok(issues.some((issue) => issue.includes("highlights[0]")), "Expected an issue for highlights[0].");

console.log("factuality.smoke passed");
