import assert from "node:assert/strict";
import { BriefPost, isPlaceholdersAllowed, isUserVisiblePlaceholderArticle, isUserVisiblePlaceholderBrief } from "@proof/shared";
import { latestPerPortfolio } from "./posts.js";

const posts: BriefPost[] = [
  {
    postId: "a-old",
    title: "A old",
    region: "au",
    portfolio: "drilling-services",
    runWindow: "apac",
    status: "published",
    publishedAt: "2026-02-04T00:00:00.000Z",
    bodyMarkdown: "old"
  },
  {
    postId: "a-new",
    title: "A new",
    region: "au",
    portfolio: "drilling-services",
    runWindow: "apac",
    status: "published",
    publishedAt: "2026-02-05T00:00:00.000Z",
    bodyMarkdown: "new"
  },
  {
    postId: "a-placeholder-newer",
    title: "Drilling Services baseline coverage activated for today's cycle",
    region: "au",
    portfolio: "drilling-services",
    runWindow: "apac",
    status: "published",
    generationStatus: "generation-failed",
    publishedAt: "2026-02-06T00:00:00.000Z",
    summary: "No material change detected today. Previous coverage remains in effect.",
    bodyMarkdown: "baseline coverage"
  },
  {
    postId: "a-carry-forward-real",
    title: "Drilling Services market pressure remains elevated",
    region: "au",
    portfolio: "drilling-services",
    runWindow: "apac",
    status: "published",
    generationStatus: "published",
    publishedAt: "2026-02-07T00:00:00.000Z",
    summary: "Supplier lead times remain volatile while APAC day-rates continue to pressure service contracts this quarter.",
    bodyMarkdown: "Real carry-forward content with evidence-backed details that should remain visible to users.",
    topStories: [
      {
        sourceArticleIndex: 1,
        title: "Fleet utilization tightens in APAC",
        url: "https://example.org/story"
      }
    ],
    tags: ["carry-forward", "generation-failed"]
  },
  {
    postId: "a-carry-forward-empty",
    title: "Coverage fallback update",
    region: "au",
    portfolio: "drilling-services",
    runWindow: "apac",
    status: "published",
    generationStatus: "published",
    publishedAt: "2026-02-08T00:00:00.000Z",
    summary: "No material change detected today. Previous coverage remains in effect.",
    bodyMarkdown: "coverage fallback",
    tags: ["carry-forward", "no-updates"]
  },
  {
    postId: "b-one",
    title: "B",
    region: "au",
    portfolio: "site-services-facilities",
    runWindow: "apac",
    status: "published",
    publishedAt: "2026-02-05T01:00:00.000Z",
    bodyMarkdown: "b"
  }
];

const latest = latestPerPortfolio(posts);

assert.equal(latest.length, 2, "expected one latest brief per portfolio");
assert.equal(
  latest.find((post) => post.portfolio === "drilling-services")?.postId,
  "a-new",
  "latestPerPortfolio should skip carry-forward placeholder rows and return most recent real post"
);

assert.equal(
  isUserVisiblePlaceholderBrief(posts[2]),
  true,
  "placeholder brief detection should identify baseline placeholders"
);

assert.equal(
  isUserVisiblePlaceholderBrief(posts[1]),
  false,
  "real published brief should not be flagged as placeholder"
);

assert.equal(
  isUserVisiblePlaceholderBrief(posts[3]),
  true,
  "carry-forward rows should be hidden from user-facing feeds"
);

assert.equal(
  isUserVisiblePlaceholderBrief(posts[4]),
  true,
  "carry-forward rows without substantive content should still be hidden"
);

assert.equal(
  isUserVisiblePlaceholderArticle({
    title: "APAC Oil & Gas feed refresh in progress",
    source: "System",
    url: "https://news.google.com/search?q=APAC%20oil%20gas%20LNG"
  }),
  true,
  "placeholder article detection should identify system fallback cards"
);

assert.equal(
  isPlaceholdersAllowed({ env: { NODE_ENV: "production" } as NodeJS.ProcessEnv }),
  false,
  "production mode should suppress placeholder publishing"
);

console.log("latest-per-portfolio.smoke passed");
