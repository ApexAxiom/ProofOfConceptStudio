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

assert(html.includes("Executive Snapshot"));
assert(html.includes("Executive Summary"));
assert(html.includes("Impact"));
assert(html.includes("Action Plan"));
assert(html.includes("Sources"));
assert(!html.includes("Market Pulse"));
assert(!html.includes("Supplier Radar"));
assert(!html.includes("Negotiation Levers"));

console.log("brief-snapshots.smoke passed");
