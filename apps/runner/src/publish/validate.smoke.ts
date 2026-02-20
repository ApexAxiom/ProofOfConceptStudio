import assert from "node:assert";
import { validateBrief } from "./validate.js";
import { BriefPost } from "@proof/shared";

const allowedUrls = new Set([
  "https://example.com/article-1",
  "https://example.com/article-2",
  "https://example.com/article-3",
  "https://example.com/article-4",
  "https://example.com/article-5",
  "https://index.example.com/region",
  "https://example.com/article-6"
]);

const indexUrls = new Set(["https://index.example.com/region"]);

const bodyMarkdown = `## 3 Takeaways
- Takeaway one with cite (https://example.com/article-1)
- Takeaway two with cite (https://example.com/article-2)
- Takeaway three with cite (https://example.com/article-3)

## Market Snapshot
- Market move with index cite (https://index.example.com/region)
- Market volume note (https://index.example.com/region)
- Market close (https://index.example.com/region)

## Developments
- Development one (https://example.com/article-4)
- Development two (https://example.com/article-5)
- Development three (https://example.com/article-6)
- Development four (https://example.com/article-1)
- Development five (https://example.com/article-2)

## Procurement Impact
- Impact one (https://example.com/article-3)
- Impact two (https://example.com/article-4)
- Impact three (https://example.com/article-5)

## Recommended Actions
- Action one (https://example.com/article-6)

## Sources
- https://example.com/article-1
- https://example.com/article-2
- https://example.com/article-3
- https://index.example.com/region
- https://example.com/article-4
- https://example.com/article-5
- https://example.com/article-6`;

const brief: BriefPost = {
  postId: "demo",
  title: "Demo Brief",
  region: "au",
  portfolio: "demo",
    runWindow: "apac",
  status: "draft",
  publishedAt: new Date().toISOString(),
  summary: "This is a demo brief summary that satisfies the minimum length rule.",
  bodyMarkdown,
  selectedArticles: [
    { title: "Article 1", url: "https://example.com/article-1", briefContent: "A detailed summary of article one that exceeds limits." },
    { title: "Article 2", url: "https://example.com/article-2", briefContent: "A detailed summary of article two that exceeds limits." },
    { title: "Article 3", url: "https://example.com/article-3", briefContent: "A detailed summary of article three that exceeds limits." }
  ],
  sources: ["https://example.com/article-1"]
};

validateBrief(brief, allowedUrls, indexUrls);
console.log("OK");

const duplicatedBrief: BriefPost = {
  postId: "dup-test",
  title: "Duplicate Coverage Brief for Validation",
  region: "au",
  portfolio: "demo",
  runWindow: "apac",
  status: "draft",
  publishedAt: new Date().toISOString(),
  summary: "Duplicate detection should keep a clean set of bullets while maintaining narrative quality for downstream readers.",
  bodyMarkdown:
    "The body intentionally includes enough content to satisfy minimum validation length. ".repeat(8),
  selectedArticles: [
    {
      title: "Article 1",
      url: "https://example.com/article-1",
      briefContent:
        "Category-level sourcing implications with enough detail to satisfy the minimum brief validation requirements."
    },
    {
      title: "Article 2",
      url: "https://example.com/article-2",
      briefContent:
        "Additional context on contract terms, supplier constraints, and market volatility across recent trading windows."
    }
  ],
  sources: [
    { sourceId: "source-1", url: "https://example.com/article-1", title: "Article 1" },
    { sourceId: "source-2", url: "https://example.com/article-2", title: "Article 2" }
  ],
  marketIndicators: [
    { id: "idx-1", label: "Index", url: "https://finance.yahoo.com/quote/CL=F", note: "Benchmark support" }
  ],
  version: "v2",
  report: {
    summaryBullets: [
      { text: "High impact event", sourceIds: ["source-1"] },
      { text: "Duplicate impact event", sourceIds: ["source-1"] },
      { text: "Another takeaway", sourceIds: ["source-2"] }
    ],
    impactGroups: [
      {
        label: "Market risk",
        bullets: [
          { text: "Duplicate impact event", sourceIds: ["source-1"] },
          { text: "Secondary impact point", sourceIds: ["source-2"] }
        ]
      }
    ],
    actionGroups: [
      {
        horizon: "Next 72 hours",
        actions: [
          {
            action: "Take specific action",
            rationale: "because of supplier timing risk",
            owner: "Category",
            expectedOutcome: "Faster response cycle",
            sourceIds: ["source-1"]
          },
          {
            action: "Rebalance coverage",
            rationale: "because contract windows are narrowing",
            owner: "Category",
            expectedOutcome: "Reduced exposure",
            sourceIds: ["source-1"]
          }
        ]
      }
    ]
  },
  deltaSinceLastRun: ["Duplicate impact event", "Distinct delta point", "Distinct delta point two"]
};

const duplicatedAllowed = new Set([
  "https://example.com/article-1",
  "https://example.com/article-2",
  "https://finance.yahoo.com/quote/CL=F"
]);
const validatedDuplicate = validateBrief(duplicatedBrief, duplicatedAllowed);
const seen = new Set<string>();
let overlap = 0;

for (const bullet of validatedDuplicate.report?.summaryBullets ?? []) {
  const normalized = bullet.text.toLowerCase().trim();
  seen.add(normalized);
}
for (const group of validatedDuplicate.report?.impactGroups ?? []) {
  for (const bullet of group.bullets) {
    const normalized = bullet.text.toLowerCase().trim();
    if (seen.has(normalized)) overlap += 1;
    seen.add(normalized);
  }
}
for (const delta of validatedDuplicate.deltaSinceLastRun ?? []) {
  const normalized = delta.toLowerCase().trim();
  if (seen.has(normalized)) overlap += 1;
  seen.add(normalized);
}

assert.strictEqual(overlap, 0);
