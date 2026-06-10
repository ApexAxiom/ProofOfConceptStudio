import assert from "node:assert";
import { BriefPost } from "@proof/shared";
import { assessBriefUsefulness } from "./usefulness.js";

const base: BriefPost = {
  postId: "u-1",
  title: "Test",
  region: "au",
  portfolio: "rigs-integrated-drilling",
  runWindow: "apac",
  status: "published",
  publishedAt: new Date().toISOString(),
  bodyMarkdown: "Body"
};

// Strong bullet: named supplier + figure → no issues.
const strong = assessBriefUsefulness({
  ...base,
  report: {
    summaryBullets: [
      { text: "Valaris secured a two-year drillship contract at a reported $480k dayrate.", sourceIds: [] }
    ],
    impactGroups: [],
    actionGroups: []
  }
});
assert.equal(strong.length, 0, `expected no issues, got: ${strong.join(" | ")}`);

// Vague bullet: no entity, no figure → flagged.
const vague = assessBriefUsefulness({
  ...base,
  report: {
    summaryBullets: [{ text: "the market continues to shift and buyers should remain ready.", sourceIds: [] }],
    impactGroups: [],
    actionGroups: []
  }
});
assert.ok(vague.some((issue) => issue.includes("summary bullet 1")), `expected vague bullet flagged: ${vague.join(" | ")}`);

// Generic filler → flagged.
const generic = assessBriefUsefulness({
  ...base,
  report: {
    summaryBullets: [{ text: "It is worth noting that various suppliers may adjust pricing.", sourceIds: [] }],
    impactGroups: [],
    actionGroups: []
  }
});
assert.ok(generic.some((issue) => issue.includes("generic filler")));

// Action rationale without "because" → flagged; with it → clean.
const actions = assessBriefUsefulness({
  ...base,
  report: {
    summaryBullets: [],
    impactGroups: [],
    actionGroups: [
      {
        horizon: "Next 72 hours",
        actions: [
          { action: "Call Valaris", rationale: "Rates are moving", owner: "Category", expectedOutcome: "Quote", sourceIds: [] },
          { action: "Refresh benchmarks", rationale: "Act now because dayrates rose 12%", owner: "Category", expectedOutcome: "Benchmark", sourceIds: [] }
        ]
      }
    ]
  }
});
assert.equal(actions.filter((issue) => issue.includes("because")).length, 1);

console.log("usefulness.smoke passed");
