import assert from "node:assert";
import { AgentConfig } from "@proof/shared";
import { buildPrompt, parsePromptOutput } from "./prompts.js";

const agent: AgentConfig = {
  id: "demo",
  portfolio: "demo-portfolio",
  label: "Demo Portfolio",
  description: "Demo",
  maxArticlesToConsider: 5,
  articlesPerRun: 2,
  feedsByRegion: { au: [], "us-mx-la-lng": [] }
};

const prompt = buildPrompt({
  agent,
  region: "au",
  runWindow: "apac",
  articles: [
    { title: "Article One", url: "https://example.com/1", content: "content" },
    { title: "Article Two", url: "https://example.com/2", content: "content" }
  ],
  indices: [
    {
      id: "idx-1",
      label: "Index One",
      url: "https://idx.com",
      regionScope: ["au"]
    }
  ],
  previousBrief: {
    title: "Yesterday Brief",
    publishedAt: new Date().toISOString(),
    highlights: ["Highlight A"],
    procurementActions: ["Action A"],
    watchlist: ["Watch A"],
    selectedArticles: [{ title: "Prev Article", url: "https://prev.com" }]
  }
});

assert(prompt.includes("PREVIOUS BRIEF CONTEXT"));
assert(prompt.includes("Yesterday Brief"));
assert(prompt.toLowerCase().includes("deltasincelastrun"));

const parsed = parsePromptOutput(
  JSON.stringify({
    title: "Sample",
    summary: "Summary",
    highlights: ["h1"],
    procurementActions: ["a1"],
    watchlist: ["w1"],
    deltaSinceLastRun: ["d1", "d2"],
    decisionSummary: {
      topMove: "Lock in price",
      whatChanged: ["Shift"],
      doNext: ["Do it"],
      watchThisWeek: ["Watch it"]
    },
    selectedArticles: [{ articleIndex: 1, briefContent: "", categoryImportance: "" }],
    heroSelection: { articleIndex: 1 },
    marketIndicators: [{ indexId: "idx-1", note: "note" }],
    cmSnapshot: {
      todayPriorities: [
        { title: "Close supplier", why: "expiring deal", dueInDays: 5, confidence: "high", evidenceArticleIndex: 1 }
      ],
      supplierRadar: [
        {
          supplier: "Acme",
          signal: "New capacity",
          implication: "More leverage",
          nextStep: "Engage SRM",
          confidence: "medium",
          evidenceArticleIndex: 1
        }
      ],
      negotiationLevers: [
        {
          lever: "Volume commit",
          whenToUse: "Renewals",
          expectedOutcome: "Rate relief",
          confidence: "medium",
          evidenceArticleIndex: 1
        }
      ],
      intelGaps: ["Need supplier cost view"],
      talkingPoints: ["Executive-ready summary"]
    },
    vpSnapshot: {
      health: {
        overall: 90,
        costPressure: 40,
        supplyRisk: 30,
        scheduleRisk: 20,
        complianceRisk: 10,
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
          action: "Do it",
          ownerRole: "Category Manager",
          dueInDays: 14,
          expectedImpact: "Better",
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
  }),
  1
);

assert.deepStrictEqual(parsed.deltaSinceLastRun, ["d1", "d2"]);
assert.strictEqual(parsed.selectedArticles.length, 1);
assert.strictEqual(parsed.vpSnapshot?.topSignals.length, 1);
assert.strictEqual(parsed.cmSnapshot?.todayPriorities.length, 1);
assert.strictEqual(parsed.decisionSummary?.doNext?.length, 1);
console.log("prompt.smoke passed");
