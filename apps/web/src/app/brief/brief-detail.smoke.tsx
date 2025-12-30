import assert from "node:assert";
import { renderToStaticMarkup } from "react-dom/server";
import { BriefDetailContent } from "./[postId]/page";
import { BriefPost } from "@proof/shared";

const brief: BriefPost = {
  postId: "test-1",
  title: "Test Brief",
  region: "au",
  portfolio: "drilling-services",
  runWindow: "apac",
  status: "published",
  publishedAt: new Date().toISOString(),
  summary: "One line summary",
  bodyMarkdown: "**Body** content only once",
  sources: ["https://example.com/source"],
  heroImageUrl: "https://example.com/hero.jpg",
  heroImageAlt: "Hero",
  selectedArticles: [
    {
      title: "Article 1",
      url: "https://example.com/a1",
      briefContent: "Content",
      sourceName: "Source",
      keyMetrics: ["10%"],
    }
  ],
  highlights: ["Highlight"],
  procurementActions: ["Do thing"],
  watchlist: ["Watch"],
  marketIndicators: [
    { id: "idx", label: "Index", url: "https://example.com/index", note: "Note" }
  ]
};

const html = renderToStaticMarkup(<BriefDetailContent brief={brief} />);

assert(html.includes("Raw brief (markdown)"));
const summaryCount = (html.match(/Executive Summary/g) || []).length;
assert.strictEqual(summaryCount, 1);
const articleHeaderCount = (html.match(/Key Intelligence/g) || []).length;
assert.strictEqual(articleHeaderCount, 1);

console.log("brief-detail.smoke passed");
