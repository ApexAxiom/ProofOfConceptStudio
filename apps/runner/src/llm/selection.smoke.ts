import assert from "node:assert";
import { parsePromptOutput } from "./prompts.js";
import { ArticleInput } from "./openai.js";

const articles: ArticleInput[] = [
  { title: "A1", url: "https://example.com/a1", content: "", ogImageUrl: "", sourceName: "S1" },
  { title: "A2", url: "https://example.com/a2", content: "", ogImageUrl: "", sourceName: "S2" },
  { title: "A3", url: "https://example.com/a3", content: "", ogImageUrl: "", sourceName: "S3" }
];

const raw = JSON.stringify({
  title: "Test",
  summary: "Summary",
  highlights: ["One", ""],
  procurementActions: ["Do this"],
  watchlist: ["Monitor X"],
  deltaSinceLastRun: ["Changed"],
  selectedArticles: [
    { articleIndex: 2, briefContent: "Brief 2" },
    { articleIndex: 1, briefContent: "Brief 1" },
    { articleIndex: 3, briefContent: "Brief 3" }
  ],
  heroSelection: { articleIndex: 2 },
  marketIndicators: [],
  vpSnapshot: {
    health: {
      overall: 50,
      costPressure: 60,
      supplyRisk: 40,
      scheduleRisk: 30,
      complianceRisk: 20,
      narrative: "Test"
    },
    topSignals: [
      {
        title: "Invalid evidence",
        type: "cost",
        horizon: "0-30d",
        confidence: "medium",
        impact: "Impact",
        evidenceArticleIndex: 99
      }
    ]
  }
});

const parsed = parsePromptOutput(raw, 3);

const mapped = parsed.selectedArticles.map((item) => {
  const idx = item.articleIndex - 1;
  return articles[idx].url;
});

assert.deepStrictEqual(mapped, ["https://example.com/a2", "https://example.com/a1", "https://example.com/a3"]);
assert.strictEqual(parsed.heroSelection.articleIndex, 2);
assert.deepStrictEqual(parsed.highlights, ["One"]);
assert.deepStrictEqual(parsed.procurementActions, ["Do this"]);
assert.deepStrictEqual(parsed.watchlist, ["Monitor X"]);
assert.deepStrictEqual(parsed.deltaSinceLastRun, ["Changed"]);
assert.strictEqual(parsed.vpSnapshot?.topSignals.length, 0);

console.log("selection.smoke passed");
