import assert from "node:assert/strict";
import { parseProcurementOutput } from "./procurement-report.js";

const raw = JSON.stringify({
  title: "Daily Brief",
  summaryBullets: [
    { text: "Rig demand rose after contract activity accelerated in key basins.", citations: [14] },
    { text: "Supplier lead times tightened as offshore maintenance cycles stacked.", citations: [15] },
    { text: "Cost pressure increased where crews were reallocated to urgent projects.", citations: [14] },
    { text: "Category teams reported lower optionality across specialized providers.", citations: [15] },
    { text: "Forward planning now depends on early slot reservations and term discipline.", citations: [14] }
  ],
  impact: {
    marketCostDrivers: [
      { text: "Service-day rates are trending higher in active offshore corridors.", citations: [14] },
      { text: "Fuel and logistics passthrough clauses are appearing more often.", citations: [15] }
    ],
    supplyBaseCapacity: [
      { text: "Provider availability is tightening where parallel campaigns overlap.", citations: [14] },
      { text: "Niche equipment windows are narrowing for short-notice work.", citations: [15] }
    ],
    contractingCommercialTerms: [
      { text: "Suppliers are preferring shorter validity windows for firm offers.", citations: [14] },
      { text: "Index-linked pricing language is becoming more common in drafts.", citations: [15] }
    ],
    riskRegulatoryOperationalConstraints: [
      { text: "Execution risk rises when mobilization slots cannot be locked early.", citations: [14] },
      { text: "Permit and readiness sequencing now has less schedule slack.", citations: [15] }
    ]
  },
  possibleActions: {
    next72Hours: [
      {
        action: "Reconfirm open supplier slots for near-term offshore requirements.",
        rationale: "Move now because short lead windows can close before internal approvals complete.",
        owner: "Category",
        expectedOutcome: "Protect immediate bid optionality for current demand.",
        citations: [14]
      },
      {
        action: "Refresh cost assumptions tied to mobilization and standby terms.",
        rationale: "Refresh the numbers because recent quote structures are shifting beyond prior baseline assumptions.",
        owner: "Contracts",
        expectedOutcome: "Reduce variance in first-pass sourcing scenarios.",
        citations: [15]
      }
    ],
    next2to4Weeks: [
      {
        action: "Update supplier wave plan for constrained service segments.",
        rationale: "Update the plan because parallel campaigns may consume capacity before next sourcing cycle.",
        owner: "Ops",
        expectedOutcome: "Improve allocation confidence for medium-horizon work.",
        citations: [14]
      },
      {
        action: "Review extension and substitution clauses for resilience.",
        rationale: "Review the clauses because commercial flexibility is needed if primary providers slip.",
        owner: "Legal",
        expectedOutcome: "Lower disruption risk under changing field schedules.",
        citations: [15]
      }
    ],
    nextQuarter: [
      {
        action: "Prepare dual-track sourcing playbook for high-volatility packages.",
        rationale: "Prepare this playbook because single-path awards face greater execution risk in tight markets.",
        owner: "Category",
        expectedOutcome: "Maintain negotiating leverage through structured alternatives.",
        citations: [14]
      },
      {
        action: "Set cadence for benchmark-triggered contract reopeners with suppliers.",
        rationale: "Set the cadence because contract economics are now more sensitive to external swings.",
        owner: "Contracts",
        expectedOutcome: "Keep term adjustments predictable and governable.",
        citations: [15]
      }
    ]
  },
  selectedArticles: [
    {
      articleIndex: 1,
      briefContent:
        "Article one details service demand growth, tighter vessel slot availability, and scheduling constraints across offshore campaigns.",
      categoryImportance:
        "Category teams must secure supplier capacity earlier and hold fallback terms for schedule volatility.",
      keyMetrics: ["Service demand growth across offshore campaigns", "Tighter vessel slot availability", "Scheduling constraints are increasing"]
    },
    {
      articleIndex: 2,
      briefContent:
        "Article two outlines contract term changes, including pricing escalators and narrower quote validity periods in active markets.",
      categoryImportance:
        "Commercial structures require tighter guardrails to keep cost exposure bounded during award cycles.",
      keyMetrics: ["Pricing escalators appearing in draft terms", "Quote validity windows are narrowing"]
    },
    {
      articleIndex: 3,
      briefContent:
        "Article three describes logistics and operational readiness constraints that can delay mobilization if not sequenced in advance.",
      categoryImportance:
        "Cross-functional planning is needed to avoid avoidable downtime and protect service continuity.",
      keyMetrics: ["Mobilization can slip if readiness steps are not sequenced", "Operational constraints raise continuity risk"]
    }
  ],
  heroSelection: { articleIndex: 3 },
  marketIndicators: [
    { indexId: "cme-wti", note: "Commodity momentum influences upstream activity levels and service demand." },
    { indexId: "ice-brent", note: "Benchmark trend supports continued project cadence in key producing basins." }
  ]
});

const parsed = parseProcurementOutput(raw, { requiredCount: 3, maxArticleIndex: 20 });

const selectedSet = new Set(parsed.selectedArticles.map((item) => item.articleIndex));
const allCitations = [
  ...parsed.summaryBullets.flatMap((item) => item.citations),
  ...parsed.impact.marketCostDrivers.flatMap((item) => item.citations),
  ...parsed.impact.supplyBaseCapacity.flatMap((item) => item.citations),
  ...parsed.impact.contractingCommercialTerms.flatMap((item) => item.citations),
  ...parsed.impact.riskRegulatoryOperationalConstraints.flatMap((item) => item.citations),
  ...parsed.possibleActions.next72Hours.flatMap((item) => item.citations),
  ...parsed.possibleActions.next2to4Weeks.flatMap((item) => item.citations),
  ...parsed.possibleActions.nextQuarter.flatMap((item) => item.citations)
];

for (const citation of allCitations) {
  assert(selectedSet.has(citation), `Citation ${citation} must map to selected article indices`);
}

const impactCount =
  parsed.impact.marketCostDrivers.length +
  parsed.impact.supplyBaseCapacity.length +
  parsed.impact.contractingCommercialTerms.length +
  parsed.impact.riskRegulatoryOperationalConstraints.length;
assert(impactCount >= 6 && impactCount <= 12, "Impact count should be normalized to 6-12 bullets");

const actionsCount =
  parsed.possibleActions.next72Hours.length +
  parsed.possibleActions.next2to4Weeks.length +
  parsed.possibleActions.nextQuarter.length;
assert(actionsCount >= 3 && actionsCount <= 7, "Action count should be normalized to 3-7 bullets");

const titleWords = parsed.title.trim().split(/\s+/).filter(Boolean);
assert(titleWords.length >= 8 && titleWords.length <= 14, "Title should be normalized to 8-14 words");
assert(!/\bdaily brief\b/i.test(parsed.title), "Title should not include Daily Brief");

assert(selectedSet.has(parsed.heroSelection.articleIndex), "Hero selection must reference selected article index");

assert.throws(() =>
  parseProcurementOutput(
    JSON.stringify({
      ...JSON.parse(raw),
      selectedArticles: [
        {
          articleIndex: 1,
          briefContent:
            "This is a longer summary that still fails because the category takeaway is generic and the facts are junk.",
          categoryImportance: "Signal relevance for sourcing, contract, or supplier-risk decisions in this category",
          keyMetrics: ["14", "2026"]
        }
      ]
    }),
    { requiredCount: 3, maxArticleIndex: 20 }
  )
);

console.log("procurement-report.smoke passed");
