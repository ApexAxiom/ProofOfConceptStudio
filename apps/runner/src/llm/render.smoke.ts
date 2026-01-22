import assert from "node:assert";
import { renderBriefMarkdown } from "./render.js";
import { SelectedArticle } from "@proof/shared";

const selectedArticles: SelectedArticle[] = [
  { title: "Story One", url: "https://example.com/1", briefContent: "Summary one" },
  { title: "Story Two", url: "https://example.com/2", briefContent: "Summary two" },
  { title: "Story Three", url: "https://example.com/3", briefContent: "Summary three" }
];

const markdown = renderBriefMarkdown({
  title: "Demo Render",
  summary: "Executive overview",
  regionLabel: "Region",
  portfolioLabel: "Portfolio",
  runWindow: "apac",
  publishedAtISO: new Date().toISOString(),
  selectedArticles,
  marketIndicators: [
    { id: "idx-1", label: "Index One", url: "https://index.test/one", note: "Context" },
    { id: "idx-2", label: "Index Two", url: "https://index.test/two", note: "Context" }
  ],
  region: "au",
  highlights: ["Highlight A"],
  procurementActions: ["Action A"],
  watchlist: ["Watch A"],
  deltaSinceLastRun: ["Delta A"]
});

assert(markdown.includes("**Source:** [Story One](https://example.com/1)"));
assert(markdown.includes("**Source:** [Story Two](https://example.com/2)"));
assert(markdown.includes("**Source:** [Story Three](https://example.com/3)"));
assert(markdown.includes("https://index.test/one"));
assert(markdown.includes("https://index.test/two"));
assert(markdown.includes("## ⚡ Market Highlights"));
assert(markdown.includes("## 🛠️ Procurement Actions"));
assert(markdown.includes("## 👀 Watchlist"));
assert(markdown.includes("## 🔄 Changes Since Last Brief"));

console.log("render.smoke passed");
