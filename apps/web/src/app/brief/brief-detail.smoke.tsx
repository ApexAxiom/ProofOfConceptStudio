import assert from "node:assert";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BriefDetailContent } from "./BriefDetailContent";
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
  decisionSummary: {
    topMove: "Lock in pricing",
    whatChanged: ["Rates moved"],
    doNext: ["Refresh bids"],
    watchThisWeek: ["Supply pinch"]
  },
  marketIndicators: [
    { id: "idx", label: "Index", url: "https://example.com/index", note: "Note" }
  ],
  marketSnapshot: [
    {
      symbol: "WTI",
      name: "WTI",
      unit: "/bbl",
      latest: 70,
      change: 1,
      changePercent: 1.4,
      asOf: new Date().toISOString(),
      sourceUrl: "https://finance.yahoo.com/quote/CL=F"
    }
  ],
  cmSnapshot: {
    todayPriorities: [
      {
        title: "Align supplier",
        why: "Capacity tight",
        dueInDays: 7,
        confidence: "high",
        evidenceArticleIndex: 1
      }
    ],
    supplierRadar: [
      {
        supplier: "Acme",
        signal: "New capacity",
        implication: "Leverage",
        nextStep: "Call supplier",
        confidence: "medium",
        evidenceArticleIndex: 1
      }
    ],
    negotiationLevers: [
      {
        lever: "Indexation cap",
        whenToUse: "Renewals",
        expectedOutcome: "Limit exposure",
        confidence: "medium",
        evidenceArticleIndex: 1
      }
    ],
    talkingPoints: ["Pipeline stable"]
  },
  vpSnapshot: {
    health: {
      overall: 80,
      costPressure: 50,
      supplyRisk: 45,
      scheduleRisk: 30,
      complianceRisk: 20,
      narrative: "Stable"
    },
    topSignals: [
      {
        title: "Signal",
        type: "cost",
        horizon: "0-30d",
        confidence: "high",
        impact: "Impact",
        evidenceArticleIndex: 1
      }
    ],
    recommendedActions: [
      {
        action: "Action",
        ownerRole: "Category Manager",
        dueInDays: 10,
        expectedImpact: "Impact",
        confidence: "medium",
        evidenceArticleIndex: 1
      }
    ],
    riskRegister: [
      {
        risk: "Risk",
        probability: "medium",
        impact: "medium",
        mitigation: "Mitigate",
        trigger: "Trigger",
        horizon: "30-180d",
        evidenceArticleIndex: 1
      }
    ]
  }
};

const html = renderToStaticMarkup(<BriefDetailContent brief={brief} />);

assert(html.includes("Executive Snapshot"));
assert(html.includes("Executive Summary"));
assert(html.includes("Impact"));
assert(html.includes("Action Plan"));
assert(html.includes("Top Stories"));
assert(html.includes("Sources"));

console.log("brief-detail.smoke passed");
