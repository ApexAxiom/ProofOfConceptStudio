import assert from "node:assert/strict";
import { BriefPost } from "@proof/shared";
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
  "latestPerPortfolio should return most recent post for each portfolio"
);

console.log("latest-per-portfolio.smoke passed");

