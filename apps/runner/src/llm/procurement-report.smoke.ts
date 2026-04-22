import assert from "node:assert/strict";
import { parseProcurementOutput } from "./procurement-report.js";

const raw = JSON.stringify({
  title: "Daily Brief",
  summaryBullets: [
    { text: "Buyers are losing flexibility as offshore demand accelerates in key basins.", citations: [14] },
    { text: "Supplier lead times are tightening where offshore maintenance cycles are stacking.", citations: [15] },
    { text: "Cost pressure is showing up through slot scarcity and readiness constraints, not only headline day rates.", citations: [14] },
    { text: "Commercial leverage is shifting toward suppliers with scarce specialist capacity.", citations: [15] },
    { text: "Short-notice work now depends more on early slot reservation and term discipline.", citations: [14] }
  ],
  impact: {
    costMoney: [
      { text: "Service-day rates are trending higher in active offshore corridors.", citations: [14] },
      { text: "Fuel and logistics pass-through clauses are appearing more often.", citations: [15] }
    ],
    supplierCommercial: [
      { text: "Provider availability is tightening where parallel campaigns overlap.", citations: [14] },
      { text: "Niche equipment windows are narrowing for short-notice work.", citations: [15] }
    ],
    safetyOperations: [
      { text: "Compressed mobilization windows can reduce execution slack if readiness slips.", citations: [14] },
      { text: "Operational dependencies are becoming more brittle when campaigns overlap.", citations: [15] }
    ],
    watchouts: [
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
        rationale: "Update the plan because parallel campaigns may consume capacity before the next sourcing cycle.",
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
        "Buyer bottom line: category teams should secure scarce supplier capacity earlier and hold fallback terms before schedules tighten further.",
      keyMetrics: ["Service demand growth across offshore campaigns", "Tighter vessel slot availability", "Scheduling constraints are increasing"],
      procurementLens: {
        buyerTakeaway: "Buyers should treat this as a live availability signal instead of waiting for a visible commercial failure before acting.",
        costMoney: "The money risk is directional: tighter slot availability can turn into expediting or standby cost if scopes stay late.",
        supplierCommercial: "Suppliers with constrained capacity can push harder on validity windows and fallback commitments.",
        safetyOperational: "Compressed scheduling can erode execution slack if mobilization and readiness steps are left too late.",
        watchouts: "Watch whether supplier commitment windows keep narrowing across the next bid cycle.",
        signalStrength: "strong",
        inferenceMode: "source-grounded"
      }
    },
    {
      articleIndex: 2,
      briefContent:
        "Article two outlines contract term changes, including pricing escalators and narrower quote validity periods in active markets.",
      categoryImportance:
        "Buyer bottom line: the real exposure may sit in term structure and quote validity, not only the headline rate.",
      keyMetrics: ["Pricing escalators appearing in draft terms", "Quote validity windows are narrowing"],
      procurementLens: {
        buyerTakeaway: "This is a contract-shape signal: buyers need to challenge which terms are becoming default before they harden into the next award.",
        costMoney: "The base rate may not move first; the real cost exposure can sit in escalators, reopeners, or shorter validity windows.",
        supplierCommercial: "Suppliers are gaining room to push term structure, not just price, so clause discipline matters.",
        safetyOperational: "The operational risk is indirect but real if term changes reduce flexibility when schedules slip.",
        watchouts: "Watch for broader pass-through language and more aggressive quote expiry on upcoming tenders.",
        signalStrength: "strong",
        inferenceMode: "source-grounded"
      }
    },
    {
      articleIndex: 3,
      briefContent:
        "Article three describes logistics and operational readiness constraints that can delay mobilization if not sequenced in advance.",
      categoryImportance:
        "Buyer bottom line: procurement has to validate readiness dependencies early or delay risk will show up in execution.",
      keyMetrics: ["Mobilization can slip if readiness steps are not sequenced", "Operational constraints raise continuity risk"],
      procurementLens: {
        buyerTakeaway: "The buyer bottom line is execution control: procurement has to validate readiness dependencies before the field plan becomes brittle.",
        costMoney: "Delay cost is the main directional risk here, especially where standby or remobilization starts to appear.",
        supplierCommercial: "Commercially, this is where buyers need clear responsibility splits for readiness and delay ownership.",
        safetyOperational: "This has a direct operations angle because compressed readiness windows can push teams toward avoidable field risk.",
        watchouts: "Watch for permit, logistics, or site-access items that are not yet contractually assigned.",
        signalStrength: "moderate",
        inferenceMode: "source-grounded"
      }
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
  ...parsed.impact.costMoney.flatMap((item) => item.citations),
  ...parsed.impact.supplierCommercial.flatMap((item) => item.citations),
  ...parsed.impact.safetyOperations.flatMap((item) => item.citations),
  ...parsed.impact.watchouts.flatMap((item) => item.citations),
  ...parsed.possibleActions.next72Hours.flatMap((item) => item.citations),
  ...parsed.possibleActions.next2to4Weeks.flatMap((item) => item.citations),
  ...parsed.possibleActions.nextQuarter.flatMap((item) => item.citations)
];

for (const citation of allCitations) {
  assert(selectedSet.has(citation), `Citation ${citation} must map to selected article indices`);
}

const impactCount =
  parsed.impact.costMoney.length +
  parsed.impact.supplierCommercial.length +
  parsed.impact.safetyOperations.length +
  parsed.impact.watchouts.length;
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
assert.equal(parsed.selectedArticles[0]?.procurementLens.signalStrength, "strong");
assert.match(parsed.selectedArticles[0]?.procurementLens.costMoney ?? "", /directional/i);

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
          keyMetrics: ["14", "2026"],
          procurementLens: {
            buyerTakeaway: "This matters for the category.",
            costMoney: "This matters for procurement.",
            supplierCommercial: "Watch for updates.",
            safetyOperational: "Monitor closely.",
            watchouts: "Track developments.",
            signalStrength: "limited",
            inferenceMode: "directional"
          }
        }
      ]
    }),
    { requiredCount: 3, maxArticleIndex: 20 }
  )
);

assert.throws(() =>
  parseProcurementOutput(
    JSON.stringify({
      ...JSON.parse(raw),
      selectedArticles: [
        {
          articleIndex: 1,
          briefContent:
            "Remote ROV work moved to an onshore control room while offshore headcount was reduced for the trial.",
          categoryImportance: "Buyer bottom line: remote operation can reshape staffing requirements and service scope.",
          keyMetrics: ["Remote ROV trial", "Onshore control room"],
          procurementLens: {
            buyerTakeaway: "This is a remote-operations sourcing signal with a real staffing and support model implication.",
            costMoney: "This could save 30% in travel cost if rolled out broadly.",
            supplierCommercial: "Contracts may need uptime and cyber language.",
            safetyOperational: "Less offshore exposure can improve safety if the link stays stable.",
            watchouts: "Watch connectivity stability and fallback procedures.",
            signalStrength: "strong",
            inferenceMode: "directional"
          }
        }
      ]
    }),
    { requiredCount: 3, maxArticleIndex: 20 }
  )
);

console.log("procurement-report.smoke passed");
