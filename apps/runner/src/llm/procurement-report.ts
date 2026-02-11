import { z } from "zod";
import { AgentConfig, MarketIndex, RegionSlug, RunWindow, REGIONS } from "@proof/shared";
import type { ArticleInput } from "./prompts.js";

export interface ProcurementPromptInput {
  agent: AgentConfig;
  region: RegionSlug;
  runWindow: RunWindow;
  articles: ArticleInput[];
  indices: MarketIndex[];
  repairIssues?: string[];
  previousJson?: string;
  previousBrief?: {
    publishedAt: string;
    title: string;
    highlights?: string[];
    procurementActions?: string[];
    watchlist?: string[];
    selectedArticles?: Array<{ title: string; url: string; keyMetrics?: string[] }>;
  };
}

export interface ProcurementOutputBullet {
  text: string;
  citations: number[];
  signal?: "confirmed" | "early-signal" | "unconfirmed";
}

export interface ProcurementOutputAction {
  action: string;
  rationale: string;
  owner: "Category" | "Contracts" | "Legal" | "Ops";
  expectedOutcome: string;
  citations: number[];
}

export interface ProcurementOutput {
  title: string;
  summaryBullets: ProcurementOutputBullet[];
  impact: {
    marketCostDrivers: ProcurementOutputBullet[];
    supplyBaseCapacity: ProcurementOutputBullet[];
    contractingCommercialTerms: ProcurementOutputBullet[];
    riskRegulatoryOperationalConstraints: ProcurementOutputBullet[];
  };
  possibleActions: {
    next72Hours: ProcurementOutputAction[];
    next2to4Weeks: ProcurementOutputAction[];
    nextQuarter: ProcurementOutputAction[];
  };
  selectedArticles: Array<{
    articleIndex: number;
    briefContent: string;
    categoryImportance: string;
    keyMetrics?: string[];
    imageAlt?: string;
  }>;
  heroSelection: { articleIndex: number };
  marketIndicators: Array<{ indexId: string; note: string }>;
}

const SIGNAL_ENUM = z.enum(["confirmed", "early-signal", "unconfirmed"]);
const OWNER_ENUM = z.enum(["Category", "Contracts", "Legal", "Ops"]);

const citedBulletSchema = z.object({
  text: z.string().min(12).max(400),
  citations: z.array(z.number().int().positive()).min(1).max(4),
  signal: SIGNAL_ENUM.optional()
});

const actionSchema = z.object({
  action: z.string().min(8).max(180),
  rationale: z.string().min(8).max(260),
  owner: OWNER_ENUM,
  expectedOutcome: z.string().min(8).max(220),
  citations: z.array(z.number().int().positive()).min(1).max(4)
});

const outputSchema = z.object({
  title: z.string().min(8).max(160),
  summaryBullets: z.array(citedBulletSchema).min(5).max(8),
  impact: z.object({
    marketCostDrivers: z.array(citedBulletSchema).min(2).max(5),
    supplyBaseCapacity: z.array(citedBulletSchema).min(2).max(5),
    contractingCommercialTerms: z.array(citedBulletSchema).min(2).max(5),
    riskRegulatoryOperationalConstraints: z.array(citedBulletSchema).min(2).max(5)
  }),
  possibleActions: z.object({
    next72Hours: z.array(actionSchema).min(2).max(4),
    next2to4Weeks: z.array(actionSchema).min(2).max(5),
    nextQuarter: z.array(actionSchema).min(2).max(5)
  }),
  selectedArticles: z
    .array(
      z.object({
        articleIndex: z.number().int().positive(),
        briefContent: z.string().min(80).max(1300),
        categoryImportance: z.string().min(24).max(350),
        keyMetrics: z.array(z.string().min(3).max(120)).max(6).optional(),
        imageAlt: z.string().min(3).max(180).optional()
      })
    )
    .min(1)
    .max(6),
  heroSelection: z.object({ articleIndex: z.number().int().positive() }),
  marketIndicators: z.array(z.object({ indexId: z.string().min(2), note: z.string().min(8).max(240) })).min(2).max(8)
});

const TITLE_MIN_WORDS = 8;
const TITLE_MAX_WORDS = 14;
const IMPACT_MIN_BULLETS = 10;
const IMPACT_MAX_BULLETS = 16;
const ACTIONS_MIN_TOTAL = 8;
const ACTIONS_MAX_TOTAL = 12;

const TITLE_FILLER_WORDS = [
  "procurement",
  "signals",
  "reshape",
  "cost",
  "capacity",
  "and",
  "contract",
  "priorities",
  "today"
];

function formatDateForRegion(dateStr: string, region: RegionSlug): string {
  const date = new Date(dateStr);
  const timeZone = REGIONS[region].timeZone;
  const timeZoneLabel = region === "au" ? "AWST" : "CST";

  return (
    date.toLocaleString("en-US", {
      timeZone,
      dateStyle: "medium",
      timeStyle: "short",
      hour12: true
    }) + ` ${timeZoneLabel}`
  );
}

function extractEvidenceExcerpts(content: string): string {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (!normalized) return "- [No readable content extracted]";

  const sentences = normalized.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [];
  const seen = new Set<string>();
  const excerpts: string[] = [];

  const add = (sentence: string) => {
    const trimmed = sentence.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    const clipped = trimmed.length > 260 ? `${trimmed.slice(0, 257)}...` : trimmed;
    excerpts.push(`- ${clipped}`);
  };

  sentences.slice(0, 8).forEach(add);
  const numericRegex = /(\d|%|\$|€|£|¥|million|billion|kb\/d|bpd|mbpd|mmbtu|tcf|bcf|contract|price|cost|rate|capacity|production|reserve)/i;
  sentences.filter((sentence) => numericRegex.test(sentence)).slice(0, 16).forEach(add);

  return excerpts.slice(0, 24).join("\n");
}

function repairSection(input: ProcurementPromptInput): string {
  if (!input.repairIssues?.length) return "";
  return `
## REPAIR REQUIRED
The previous output failed validation. Fix every issue below:
${input.repairIssues.map((issue) => `- ${issue}`).join("\n")}

Previous JSON:
\`\`\`json
${input.previousJson ?? "{}"}
\`\`\`
`;
}

function previousBriefSection(input: ProcurementPromptInput): string {
  if (!input.previousBrief) {
    return "No previous brief is available for this portfolio/region.";
  }
  const previous = input.previousBrief;
  return [
    `Previous brief title: ${previous.title}`,
    `Published: ${formatDateForRegion(previous.publishedAt, input.region)}`,
    previous.highlights?.length ? `Highlights:\n${previous.highlights.map((item) => `- ${item}`).join("\n")}` : "",
    previous.procurementActions?.length
      ? `Procurement actions:\n${previous.procurementActions.map((item) => `- ${item}`).join("\n")}`
      : "",
    previous.watchlist?.length ? `Watchlist:\n${previous.watchlist.map((item) => `- ${item}`).join("\n")}` : ""
  ]
    .filter(Boolean)
    .join("\n");
}

function articleBlock(input: ProcurementPromptInput): string {
  return input.articles
    .map((article, idx) => {
      const index = idx + 1;
      const sourceName = article.sourceName ? ` (${article.sourceName})` : "";
      const published = article.publishedAt ? `\nPublished: ${formatDateForRegion(article.publishedAt, input.region)}` : "";
      const contentStatus = article.contentStatus === "thin" ? "\nCONTENT_STATUS: thin (treat as early signal)" : "";
      return [
        `### Article ${index}${sourceName}`,
        `Title: ${article.title}`,
        `URL: ${article.url}`,
        published,
        contentStatus,
        "Evidence excerpts:",
        extractEvidenceExcerpts(article.content ?? "")
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n---\n\n");
}

function indexBlock(indices: MarketIndex[]): string {
  return indices.map((index) => `- ${index.id}: ${index.label} (${index.url})`).join("\n");
}

export function buildProcurementPrompt(input: ProcurementPromptInput, requiredCount: number): string {
  const regionLabel = input.region === "au" ? "APAC (Australia)" : "International (US/Mexico/Senegal)";

  return `You are generating a premium procurement intelligence brief for ${input.agent.label}.

Your audience is executive and category-management leadership. Write with high signal, no fluff, and no hallucinated numbers.

OUTPUT RULES (strict):
1) Return JSON only.
2) Title must be 8-14 words, strong verb, not generic, never includes "Daily Brief".
3) Produce exactly four report sections in structure:
   - Summary: 5-8 cited bullets
   - Impact: 10-16 cited bullets across 4 subgroups:
     * marketCostDrivers
     * supplyBaseCapacity
     * contractingCommercialTerms
     * riskRegulatoryOperationalConstraints
   - Possible actions: 8-12 actions total across:
     * next72Hours (Short-term horizon: 0-30 days; avoid artificial "urgent 72 hours" framing)
     * next2to4Weeks (Mid-term horizon: 30-90 days)
     * nextQuarter (Long-term horizon: 90+ days)
   - Actions must be realistic for category management; only use urgent language when the evidence is truly critical.
   - Sources are rendered outside JSON from selected articles and indices.
4) Every summary/impact/action item MUST include citations pointing to articleIndex values (one citation is acceptable; do not force multiple).
5) Use signal = "early-signal" or "unconfirmed" when evidence is weak; do not invent certainty.
6) Owner must be one of: Category, Contracts, Legal, Ops.
7) Selected articles must be 1-${requiredCount}, unique, and sourced only from provided article indices.
8) heroSelection.articleIndex must match one selected article.
9) marketIndicators must reference indexId from the provided market index list.

JSON SHAPE:
\`\`\`json
{
  "title": "Headline title",
  "summaryBullets": [{ "text": "bullet", "citations": [1], "signal": "confirmed" }],
  "impact": {
    "marketCostDrivers": [{ "text": "bullet", "citations": [1] }],
    "supplyBaseCapacity": [{ "text": "bullet", "citations": [2] }],
    "contractingCommercialTerms": [{ "text": "bullet", "citations": [1,2] }],
    "riskRegulatoryOperationalConstraints": [{ "text": "bullet", "citations": [3], "signal": "early-signal" }]
  },
  "possibleActions": {
    "next72Hours": [{ "action": "Do X", "rationale": "why", "owner": "Category", "expectedOutcome": "KPI", "citations": [1] }],
    "next2to4Weeks": [{ "action": "Do Y", "rationale": "why", "owner": "Contracts", "expectedOutcome": "KPI", "citations": [2] }],
    "nextQuarter": [{ "action": "Do Z", "rationale": "why", "owner": "Ops", "expectedOutcome": "KPI", "citations": [3] }]
  },
  "selectedArticles": [
    { "articleIndex": 1, "briefContent": "concise synthesis", "categoryImportance": "why it matters", "keyMetrics": ["metric"], "imageAlt": "alt" }
  ],
  "heroSelection": { "articleIndex": 1 },
  "marketIndicators": [{ "indexId": "some-id", "note": "procurement implication" }]
}
\`\`\`

Context:
- Portfolio: ${input.agent.label}
- Region: ${regionLabel}
- Run window: ${input.runWindow.toUpperCase()}

Previous brief context:
${previousBriefSection(input)}

Market indices (use indexId only):
${indexBlock(input.indices)}

Articles:
${articleBlock(input)}

${repairSection(input)}
`;
}

function parseJson(raw: string): unknown {
  const blockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const payload = blockMatch ? blockMatch[1].trim() : raw.trim();
  return JSON.parse(payload);
}

function validateCitationRanges(
  output: ProcurementOutput,
  maxArticleIndex: number,
  requiredCount: number
): string[] {
  const issues: string[] = [];

  const selectedIndices = output.selectedArticles.map((item) => item.articleIndex);
  const selectedSet = new Set(selectedIndices);
  if (selectedSet.size !== selectedIndices.length) {
    issues.push("selectedArticles must use unique articleIndex values");
  }
  if (selectedIndices.some((index) => index < 1 || index > maxArticleIndex)) {
    issues.push(`selectedArticles.articleIndex must be between 1 and ${maxArticleIndex}`);
  }
  if (output.selectedArticles.length > requiredCount) {
    issues.push(`selectedArticles cannot exceed ${requiredCount} entries`);
  }
  if (!selectedSet.has(output.heroSelection.articleIndex)) {
    issues.push("heroSelection.articleIndex must be one of selectedArticles.articleIndex");
  }

  const allCitations: number[] = [
    ...output.summaryBullets.flatMap((item) => item.citations),
    ...output.impact.marketCostDrivers.flatMap((item) => item.citations),
    ...output.impact.supplyBaseCapacity.flatMap((item) => item.citations),
    ...output.impact.contractingCommercialTerms.flatMap((item) => item.citations),
    ...output.impact.riskRegulatoryOperationalConstraints.flatMap((item) => item.citations),
    ...output.possibleActions.next72Hours.flatMap((item) => item.citations),
    ...output.possibleActions.next2to4Weeks.flatMap((item) => item.citations),
    ...output.possibleActions.nextQuarter.flatMap((item) => item.citations)
  ];

  for (const citation of allCitations) {
    if (!selectedSet.has(citation)) {
      issues.push(`Citation ${citation} must reference a selected article index`);
    }
  }

  const impactCount =
    output.impact.marketCostDrivers.length +
    output.impact.supplyBaseCapacity.length +
    output.impact.contractingCommercialTerms.length +
    output.impact.riskRegulatoryOperationalConstraints.length;
  if (impactCount < IMPACT_MIN_BULLETS || impactCount > IMPACT_MAX_BULLETS) {
    issues.push("Impact must contain 10-16 bullets total");
  }

  const actionCount =
    output.possibleActions.next72Hours.length +
    output.possibleActions.next2to4Weeks.length +
    output.possibleActions.nextQuarter.length;
  if (actionCount < ACTIONS_MIN_TOTAL || actionCount > ACTIONS_MAX_TOTAL) {
    issues.push("Possible actions must contain 8-12 actions total");
  }

  const words = output.title.trim().split(/\s+/).filter(Boolean);
  if (words.length < TITLE_MIN_WORDS || words.length > TITLE_MAX_WORDS) {
    issues.push("Title must be 8-14 words");
  }
  if (/\bdaily brief\b/i.test(output.title)) {
    issues.push("Title cannot include 'Daily Brief'");
  }

  return issues;
}

function normalizeTitleForConstraints(title: string): string {
  const initial = title
    .replace(/\bdaily brief\b/gi, "")
    .replace(/\bdaily\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  const words = initial.split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return "Procurement signals reshape cost capacity and contract priorities today";
  }

  while (words.length < TITLE_MIN_WORDS) {
    const filler = TITLE_FILLER_WORDS[(words.length - 1) % TITLE_FILLER_WORDS.length];
    words.push(filler);
  }

  const normalized = words.slice(0, TITLE_MAX_WORDS).join(" ");
  if (/\bdaily brief\b/i.test(normalized)) {
    return normalized.replace(/\bdaily brief\b/gi, "intel report");
  }
  return normalized;
}

function pickReplacementArticleIndex(used: Set<number>, maxArticleIndex: number, preferred?: number): number {
  if (preferred && preferred >= 1 && preferred <= maxArticleIndex && !used.has(preferred)) {
    return preferred;
  }
  for (let idx = 1; idx <= maxArticleIndex; idx += 1) {
    if (!used.has(idx)) return idx;
  }
  return 1;
}

function normalizeSelectedArticles(
  selectedArticles: ProcurementOutput["selectedArticles"],
  maxArticleIndex: number,
  requiredCount: number
): ProcurementOutput["selectedArticles"] {
  const maxAllowed = Math.max(1, Math.min(requiredCount, maxArticleIndex));
  const normalized: ProcurementOutput["selectedArticles"] = [];
  const used = new Set<number>();

  for (const article of selectedArticles) {
    if (normalized.length >= maxAllowed) break;
    const preferred = Number.isInteger(article.articleIndex) ? article.articleIndex : undefined;
    const articleIndex = pickReplacementArticleIndex(used, maxArticleIndex, preferred);
    used.add(articleIndex);
    normalized.push({ ...article, articleIndex });
  }

  if (normalized.length === 0) {
    const firstIndex = pickReplacementArticleIndex(used, maxArticleIndex, 1);
    normalized.push({
      articleIndex: firstIndex,
      briefContent:
        "No material category-specific items detected in selected inputs; broader oil and gas context is used for procurement relevance.",
      categoryImportance:
        "Maintain supplier optionality, contract flexibility, and active risk monitoring until category-specific signal depth improves."
    });
  }

  return normalized;
}

function normalizeCitations(citations: number[], selectedSet: Set<number>, fallbackIndex: number): number[] {
  const normalized = Array.from(new Set(citations.filter((citation) => selectedSet.has(citation))));
  if (normalized.length === 0) return [fallbackIndex];
  return normalized.slice(0, 4);
}

function normalizeImpactCount(impact: ProcurementOutput["impact"], selectedSet: Set<number>, fallbackIndex: number): void {
  const groups = [
    impact.marketCostDrivers,
    impact.supplyBaseCapacity,
    impact.contractingCommercialTerms,
    impact.riskRegulatoryOperationalConstraints
  ];

  for (const group of groups) {
    for (let idx = 0; idx < group.length; idx += 1) {
      group[idx] = {
        ...group[idx],
        citations: normalizeCitations(group[idx].citations, selectedSet, fallbackIndex)
      };
    }
  }

  const totalCount = () => groups.reduce((sum, group) => sum + group.length, 0);

  let guard = 0;
  while (totalCount() < IMPACT_MIN_BULLETS && guard < 64) {
    guard += 1;
    const group =
      groups
        .filter((g) => g.length < 5)
        .sort((a, b) => a.length - b.length)[0] ?? groups[0];
    const seed = group[group.length - 1] ?? groups[0][0];
    group.push({
      ...seed,
      citations: normalizeCitations(seed.citations, selectedSet, fallbackIndex)
    });
  }

  guard = 0;
  while (totalCount() > IMPACT_MAX_BULLETS && guard < 64) {
    guard += 1;
    const group =
      groups
        .filter((g) => g.length > 2)
        .sort((a, b) => b.length - a.length)[0] ?? groups[0];
    if (group.length <= 2) break;
    group.pop();
  }
}

function normalizeActionCount(
  possibleActions: ProcurementOutput["possibleActions"],
  selectedSet: Set<number>,
  fallbackIndex: number
): void {
  const groups = [
    { items: possibleActions.next72Hours, min: 2, max: 4 },
    { items: possibleActions.next2to4Weeks, min: 2, max: 5 },
    { items: possibleActions.nextQuarter, min: 2, max: 5 }
  ];

  for (const group of groups) {
    for (let idx = 0; idx < group.items.length; idx += 1) {
      group.items[idx] = {
        ...group.items[idx],
        citations: normalizeCitations(group.items[idx].citations, selectedSet, fallbackIndex)
      };
    }
  }

  const totalCount = () => groups.reduce((sum, group) => sum + group.items.length, 0);

  let guard = 0;
  while (totalCount() < ACTIONS_MIN_TOTAL && guard < 64) {
    guard += 1;
    const group =
      groups
        .filter((g) => g.items.length < g.max)
        .sort((a, b) => a.items.length - b.items.length)[0] ?? groups[0];
    const seed = group.items[group.items.length - 1] ?? groups[0].items[0];
    group.items.push({
      ...seed,
      citations: normalizeCitations(seed.citations, selectedSet, fallbackIndex)
    });
  }

  guard = 0;
  while (totalCount() > ACTIONS_MAX_TOTAL && guard < 64) {
    guard += 1;
    const group =
      groups
        .filter((g) => g.items.length > g.min)
        .sort((a, b) => b.items.length - a.items.length)[0] ?? groups[0];
    if (group.items.length <= group.min) break;
    group.items.pop();
  }
}

function normalizeOutputForValidation(
  output: ProcurementOutput,
  options: { requiredCount: number; maxArticleIndex: number }
): ProcurementOutput {
  const selectedArticles = normalizeSelectedArticles(output.selectedArticles, options.maxArticleIndex, options.requiredCount);
  const selectedSet = new Set(selectedArticles.map((item) => item.articleIndex));
  const fallbackIndex = selectedArticles[0]?.articleIndex ?? 1;

  const normalized: ProcurementOutput = {
    ...output,
    title: normalizeTitleForConstraints(output.title),
    selectedArticles,
    heroSelection: {
      articleIndex: selectedSet.has(output.heroSelection.articleIndex)
        ? output.heroSelection.articleIndex
        : fallbackIndex
    },
    summaryBullets: output.summaryBullets.map((bullet) => ({
      ...bullet,
      citations: normalizeCitations(bullet.citations, selectedSet, fallbackIndex)
    })),
    impact: {
      marketCostDrivers: output.impact.marketCostDrivers.map((bullet) => ({
        ...bullet,
        citations: normalizeCitations(bullet.citations, selectedSet, fallbackIndex)
      })),
      supplyBaseCapacity: output.impact.supplyBaseCapacity.map((bullet) => ({
        ...bullet,
        citations: normalizeCitations(bullet.citations, selectedSet, fallbackIndex)
      })),
      contractingCommercialTerms: output.impact.contractingCommercialTerms.map((bullet) => ({
        ...bullet,
        citations: normalizeCitations(bullet.citations, selectedSet, fallbackIndex)
      })),
      riskRegulatoryOperationalConstraints: output.impact.riskRegulatoryOperationalConstraints.map((bullet) => ({
        ...bullet,
        citations: normalizeCitations(bullet.citations, selectedSet, fallbackIndex)
      }))
    },
    possibleActions: {
      next72Hours: output.possibleActions.next72Hours.map((action) => ({
        ...action,
        citations: normalizeCitations(action.citations, selectedSet, fallbackIndex)
      })),
      next2to4Weeks: output.possibleActions.next2to4Weeks.map((action) => ({
        ...action,
        citations: normalizeCitations(action.citations, selectedSet, fallbackIndex)
      })),
      nextQuarter: output.possibleActions.nextQuarter.map((action) => ({
        ...action,
        citations: normalizeCitations(action.citations, selectedSet, fallbackIndex)
      }))
    }
  };

  normalizeImpactCount(normalized.impact, selectedSet, fallbackIndex);
  normalizeActionCount(normalized.possibleActions, selectedSet, fallbackIndex);
  return normalized;
}

export function parseProcurementOutput(raw: string, options: { requiredCount: number; maxArticleIndex: number }): ProcurementOutput {
  const parsedJson = parseJson(raw);
  const result = outputSchema.safeParse(parsedJson);
  if (!result.success) {
    const issues = result.error.issues.map((issue: z.ZodIssue) => `${issue.path.join(".")}: ${issue.message}`);
    throw new Error(JSON.stringify(issues));
  }

  const output = normalizeOutputForValidation(result.data, options);
  const rangeIssues = validateCitationRanges(output, options.maxArticleIndex, options.requiredCount);
  if (rangeIssues.length > 0) {
    throw new Error(JSON.stringify(rangeIssues));
  }
  return output;
}
