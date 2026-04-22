import assert from "node:assert/strict";
import type { BriefPost, MarketIndex } from "@proof/shared";
import {
  buildRewriteArticleInputs,
  collectRewriteSourceCandidates,
  mergeRewrittenBriefItem
} from "./brief-rewrite-lib.js";

async function main() {
  const brief: BriefPost = {
    postId: "brief-1",
    runKey: "2026-04-22#au#rigs-integrated-drilling",
    briefDay: "2026-04-22",
    title: "Original brief",
    region: "au",
    portfolio: "rigs-integrated-drilling",
    runWindow: "apac",
    status: "published",
    publishedAt: "2026-04-22T08:00:00.000Z",
    summary: "Stored summary fallback",
    bodyMarkdown: "Stored **markdown** fallback context for historical rewrite.",
    selectedArticles: [
      {
        title: "Remote ROV trial expands",
        url: "https://example.com/article-1",
        briefContent: "Operators expanded a remote ROV operating trial.",
        categoryImportance: "Buyers should check what labor can move offsite.",
        keyMetrics: ["Remote trial expanded"],
        sourceId: "s1"
      }
    ],
    sources: [
      {
        sourceId: "s1",
        url: "https://example.com/article-1",
        title: "Remote ROV trial expands"
      },
      {
        sourceId: "s2",
        url: "https://example.com/article-2",
        title: "Secondary article"
      },
      {
        sourceId: "idx1",
        url: "https://example.com/index",
        title: "Index"
      }
    ],
    claims: [
      {
        id: "claim-1",
        section: "top_story",
        text: "Remote ROV operating models can reduce offshore headcount exposure.",
        status: "supported",
        evidence: [
          {
            sourceId: "s1",
            url: "https://example.com/article-1",
            excerpt: "Remote operation shifts work to an onshore control center."
          }
        ]
      }
    ]
  };

  const indices: MarketIndex[] = [
    { id: "idx1", label: "Index", url: "https://example.com/index", regionScope: ["au"] }
  ];

  const candidates = collectRewriteSourceCandidates(brief, indices, 5);
  assert.equal(candidates.length, 2);
  assert.equal(candidates[0]?.url, "https://example.com/article-1");
  assert.equal(candidates[1]?.url, "https://example.com/article-2");

  const inputs = await buildRewriteArticleInputs({
    brief,
    indices,
    fetchDetails: async (url) => ({
      url,
      title: url.endsWith("article-1") ? "Fetched article 1" : "Fetched article 2",
      content: url.endsWith("article-1")
        ? ""
        : "Supplier availability tightened for the next campaign, with fewer open windows across the planned execution period. Operators are now sequencing work earlier, and suppliers are signaling that short-notice requests will face narrower commitment windows and more explicit readiness conditions before mobilization.",
      sourceName: "Energy Wire",
      publishedAt: "2026-04-22T06:00:00.000Z"
    })
  });

  assert.equal(inputs.length, 2);
  assert.equal(inputs[0]?.title, "Fetched article 1");
  assert.match(inputs[0]?.content ?? "", /onshore control center/i);
  assert.match(inputs[0]?.content ?? "", /buyers should check what labor can move offsite/i);
  assert.equal(inputs[1]?.contentStatus, "ok");

  const merged = mergeRewrittenBriefItem({
    item: {
      ...(brief as BriefPost),
      PK: "POST#brief-1",
      SK: "DAY#2026-04-22",
      GSI1PK: "PORTFOLIO#rigs-integrated-drilling",
      GSI1SK: "DATE#2026-04-22T08:00:00.000Z",
      GSI2PK: "REGION#au",
      GSI2SK: "DATE#2026-04-22T08:00:00.000Z",
      GSI3PK: "STATUS#published",
      GSI3SK: "DATE#2026-04-22T08:00:00.000Z"
    },
    rewrittenBrief: {
      ...brief,
      title: "Rewritten brief",
      summary: "New summary"
    }
  });

  assert.equal(merged.postId, brief.postId);
  assert.equal(merged.runKey, brief.runKey);
  assert.equal(merged.publishedAt, brief.publishedAt);
  assert.equal(merged.title, "Rewritten brief");
  assert.equal(merged.PK, "POST#brief-1");

  console.log("brief-rewrite.smoke passed");
}

main();
