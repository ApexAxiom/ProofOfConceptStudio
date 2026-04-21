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
  sources: [
    {
      sourceId: "s1",
      url: "https://example.com/a1",
      title: "Article 1",
      publishedAt: new Date().toISOString()
    },
    {
      sourceId: "s2",
      url: "https://example.com/index",
      title: "Index",
      publishedAt: new Date().toISOString()
    }
  ],
  heroImageUrl: "https://example.com/hero.jpg",
  heroImageAlt: "Hero",
  contextNote: "Category coverage is strong today, with one market index used for context.",
  selectedArticles: [
    {
      title: "Article 1",
      url: "https://example.com/a1",
      briefContent: "Content",
      sourceName: "Source",
      keyMetrics: ["10%"],
      sourceId: "s1",
      categoryImportance: "This affects supplier pricing and negotiation posture for the category."
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
  report: {
    summaryBullets: [
      { text: "Takeaway one", sourceIds: ["s1"] },
      { text: "Takeaway two", sourceIds: ["s1"] },
      { text: "Takeaway three", sourceIds: ["s2"] }
    ],
    impactGroups: [
      {
        label: "Risk",
        bullets: [{ text: "Takeaway one", sourceIds: ["s1"] }, { text: "Rates improved", sourceIds: ["s1"] }]
      }
    ],
    actionGroups: [
      {
        horizon: "Next 72 hours",
        actions: [
          {
            action: "Action one",
            rationale: "because a trigger",
            owner: "Category",
            expectedOutcome: "Outcome",
            sourceIds: ["s1"]
          }
        ]
      }
    ]
  },
  claims: [
    {
      id: "claim-1",
      text: "Takeaway one",
      section: "summary",
      status: "supported",
      evidence: [
        {
          sourceId: "s1",
          url: "https://example.com/a1",
          excerpt: "Article 1 reported a concrete category pricing move."
        }
      ]
    }
  ],
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

assert(html.includes("Coverage note"));
assert(html.includes("In 60 seconds"));
assert(html.includes("Why it matters"));
assert(html.includes("Top stories"));
assert(html.includes("What to do / What to watch"));
assert(html.includes("Sources"));
assert(html.includes("Market pulse"));
assert(html.includes("Executive Risk &amp; Action View"));
assert(html.includes("Category Manager Decision Detail"));
assert(html.includes("Supplier radar"));
assert(html.includes("Negotiation levers"));
assert(html.includes("Source notes [1]"));
assert(html.includes("AI reading"));
assert(html.includes("Used in this brief"));
assert(html.includes("Open original source"));
assert(html.includes("Read source"));
assert(html.includes("What happened"));
assert(html.includes("Why this matters for this category"));

console.log("brief-detail.smoke passed");
