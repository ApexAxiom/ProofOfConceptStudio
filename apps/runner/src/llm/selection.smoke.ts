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
  selectedArticles: [
    { articleIndex: 2, briefContent: "Brief 2" },
    { articleIndex: 1, briefContent: "Brief 1" },
    { articleIndex: 3, briefContent: "Brief 3" }
  ],
  heroSelection: { articleIndex: 2 },
  marketIndicators: []
});

const parsed = parsePromptOutput(raw, 3);

const mapped = parsed.selectedArticles.map((item) => {
  const idx = item.articleIndex - 1;
  return articles[idx].url;
});

assert.deepStrictEqual(mapped, ["https://example.com/a2", "https://example.com/a1", "https://example.com/a3"]);
assert.strictEqual(parsed.heroSelection.articleIndex, 2);

console.log("selection.smoke passed");
