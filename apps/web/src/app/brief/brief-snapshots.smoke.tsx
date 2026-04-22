import assert from "node:assert";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BriefDetailContent } from "./BriefDetailContent";
import { BriefPost } from "@proof/shared";

const brief: BriefPost = {
  postId: "snapshot-1",
  title: "Snapshot Brief",
  region: "us-mx-la-lng",
  portfolio: "subsea-surf-offshore",
  runWindow: "international",
  status: "published",
  publishedAt: new Date().toISOString(),
  summary: "Summary",
  bodyMarkdown: "Body",
  sources: ["https://example.com/source"],
  selectedArticles: [
    {
      title: "Article 1",
      url: "https://example.com/a1",
      briefContent: "Content",
      sourceName: "Source"
    }
  ],
  cmSnapshot: {
    todayPriorities: [
      {
        title: "Engage supplier",
        why: "Capacity shift",
        dueInDays: 5,
        confidence: "high",
        evidenceArticleIndex: 1
      }
    ],
    supplierRadar: [],
    negotiationLevers: [],
    talkingPoints: ["Align on next week"]
  },
  vpSnapshot: {
    health: {
      overall: 70,
      costPressure: 45,
      supplyRisk: 55,
      scheduleRisk: 30,
      complianceRisk: 20,
      narrative: "Contained"
    },
    topSignals: [],
    recommendedActions: [],
    riskRegister: []
  }
};

const html = renderToStaticMarkup(<BriefDetailContent brief={brief} />);

assert(html.includes("In 60 seconds"));
assert(html.includes("Why it matters"));
assert(html.includes("Top stories"));
assert(html.includes("What to do / What to watch"));
assert(html.includes("Sources"));
assert(html.includes("Executive Risk &amp; Action View"));
assert(html.includes("Category Manager Decision Detail"));
assert(!html.includes("Market pulse"));
assert(html.includes("Read source"));
assert(html.includes("Open original source"));
assert(html.includes("Buyer takeaway"));
assert(html.includes("Cost / money"));
assert(html.includes("Supplier / commercial"));
assert(html.includes("Safety / operations"));
assert(html.includes("What to watch"));

console.log("brief-snapshots.smoke passed");
