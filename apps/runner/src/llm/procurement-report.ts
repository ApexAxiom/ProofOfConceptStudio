import { z } from "zod";
import { AgentConfig, BriefV2NewsStatus, MarketIndex, RegionSlug, RunWindow, REGIONS } from "@proof/shared";
import type { ArticleInput } from "./prompts.js";

export interface ProcurementPromptInput {
  agent: AgentConfig;
  region: RegionSlug;
  runWindow: RunWindow;
  articles: ArticleInput[];
  indices: MarketIndex[];
  newsStatus?: BriefV2NewsStatus;
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
  deltaSinceLastRun?: string[];
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
const OUTPUT_SUMMARY_BULLETS = 5;
const BECAUSE_TRIGGER = /\bbecause\b/i;
const MIN_RATIONALE_WORDS = 8;
const CITATION_LIST_LIMIT = 4;
const GENERIC_CATEGORY_IMPORTANCE_PATTERNS = [
  /signal relevance for sourcing, contract, or supplier-risk decisions in this category/i,
  /^this matters for this category\.?$/i,
  /^category takeaway\.?$/i
];
const GENERIC_BRIEF_CONTENT_PATTERNS = [
  /^home\b/i,
  /\bshutterstock\b/i,
  /\bclick here\b/i,
  /\bread more\b/i,
  /\bsubscribe\b/i
];

function normalizeComparableText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s%./-]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isLowValueFact(value: string): boolean {
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (!trimmed) return true;
  if (!/[a-z]/i.test(trimmed)) return true;
  if (/^(19|20)\d{2}$/.test(trimmed)) return true;
  if (/^\d[\d.,%/$-]*$/.test(trimmed)) return true;
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length === 1 && /\d/.test(words[0])) return true;
  if (trimmed.length < 8) return true;
  return false;
}

function isGenericCategoryImportance(value: string): boolean {
  return GENERIC_CATEGORY_IMPORTANCE_PATTERNS.some((pattern) => pattern.test(value));
}

function isExtractiveStoryCopy(value: string): boolean {
  return GENERIC_BRIEF_CONTENT_PATTERNS.some((pattern) => pattern.test(value));
}

const citedBulletSchema = z.object({
  text: z.string().min(12).max(400),
  citations: z.array(z.number().int().positive()).min(0).max(CITATION_LIST_LIMIT),
  signal: SIGNAL_ENUM.optional()
});

const actionSchema = z.object({
  action: z.string().min(8).max(180),
  rationale: z.string().min(MIN_RATIONALE_WORDS).max(260),
  owner: OWNER_ENUM,
  expectedOutcome: z.string().min(8).max(220),
  citations: z.array(z.number().int().positive()).min(1).max(4)
}).superRefine((value, context) => {
  if (!BECAUSE_TRIGGER.test(value.rationale)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "action.rationale must include a trigger clause using 'because ...'"
    });
  }
});

const outputSchema = z.object({
  title: z.string().min(8).max(160),
  summaryBullets: z.array(citedBulletSchema).length(OUTPUT_SUMMARY_BULLETS),
  impact: z.object({
    marketCostDrivers: z.array(citedBulletSchema).min(1).max(4),
    supplyBaseCapacity: z.array(citedBulletSchema).min(1).max(4),
    contractingCommercialTerms: z.array(citedBulletSchema).min(1).max(4),
    riskRegulatoryOperationalConstraints: z.array(citedBulletSchema).min(1).max(4)
  }),
  deltaSinceLastRun: z.array(z.string().min(10).max(220)).max(3).optional(),
  possibleActions: z.object({
    next72Hours: z.array(actionSchema).min(1).max(3),
    next2to4Weeks: z.array(actionSchema).min(1).max(3),
    nextQuarter: z.array(actionSchema).min(1).max(3)
  }),
  selectedArticles: z
    .array(
      z.object({
        articleIndex: z.number().int().positive(),
        briefContent: z.string().min(80).max(1300),
        categoryImportance: z.string().min(24).max(350),
        keyMetrics: z.array(z.string().min(8).max(140)).min(1).max(4).optional(),
        imageAlt: z.string().min(3).max(180).optional()
      }).superRefine((value, context) => {
        if (isGenericCategoryImportance(value.categoryImportance)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "selectedArticles.categoryImportance must be category-specific, not placeholder text"
          });
        }
        if (isExtractiveStoryCopy(value.briefContent)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "selectedArticles.briefContent looks like raw article copy or page chrome"
          });
        }
        if (normalizeComparableText(value.briefContent) === normalizeComparableText(value.categoryImportance)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "selectedArticles.briefContent and categoryImportance must not repeat the same sentence"
          });
        }
        for (const metric of value.keyMetrics ?? []) {
          if (isLowValueFact(metric)) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              message: "selectedArticles.keyMetrics must be readable facts, not bare numbers or dates"
            });
            break;
          }
        }
      })
    )
    .min(1)
    .max(6),
  heroSelection: z.object({ articleIndex: z.number().int().positive() }),
  marketIndicators: z.array(z.object({ indexId: z.string().min(2), note: z.string().min(8).max(240) })).min(2).max(8)
});

const TITLE_MIN_WORDS = 8;
const TITLE_MAX_WORDS = 14;
const IMPACT_MIN_BULLETS = 6;
const IMPACT_MAX_BULLETS = 12;
const ACTIONS_MIN_TOTAL = 3;
const ACTIONS_MAX_TOTAL = 7;

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
  const coverageMode =
    input.newsStatus === "fallback-context"
      ? "Light signal day. Category-specific coverage is thin, so some broader market context is included."
      : input.newsStatus === "thin-category"
        ? "Light signal day. Category-specific coverage is thin; avoid overstating certainty."
        : "Normal signal day. Use the strongest category-specific developments first.";

  return `You are generating a premium procurement intelligence brief for ${input.agent.label}.

Your audience is adult business readers across a wide range of education levels.
Write in plain English with high signal, no fluff, and no hallucinated numbers.
Do not sound academic, legalistic, or overly executive.
If you use industry jargon or an acronym, make the meaning obvious in context.
Readers should quickly understand why this matters and what is worth paying attention to.

OUTPUT RULES (strict):
1) Return JSON only.
2) Title must be 8-14 words, strong verb, not generic, never includes "Daily Brief".
3) Write like a smart analyst speaking clearly, not like a press release.
4) If today's signal is light, say so directly and calmly. Do not manufacture urgency.
5) Produce exactly four report sections in structure:
   - Summary: exactly 5 cited bullets
     - Bullets 1-3 are key takeaways
     - Bullets 4-5 are extra context
   - Impact: 6-12 cited bullets across 4 subgroups:
     * marketCostDrivers
     * supplyBaseCapacity
     * contractingCommercialTerms
     * riskRegulatoryOperationalConstraints
   - Possible actions: 3-7 actions total across:
     * next72Hours (Short-term horizon: 0-30 days; avoid artificial "urgent 72 hours" framing)
     * next2to4Weeks (Mid-term horizon: 30-90 days)
     * nextQuarter (Long-term horizon: 90+ days)
   - Actions must be realistic for category management; on light-signal days, "watch / verify / prepare" actions are better than fake urgency.
   - Sources are rendered outside JSON from selected articles and indices.
6) Every summary/impact/action item MUST include citations pointing to articleIndex values (one citation is acceptable; do not force multiple).
7) Use signal = "early-signal" or "unconfirmed" when evidence is weak; do not invent certainty.
8) Owner must be one of: Category, Contracts, Legal, Ops.
9) Every action rationale must include a trigger clause using "because ...".
10) Selected articles must be 1-${requiredCount}, unique, and sourced only from provided article indices.
11) heroSelection.articleIndex must match one selected article.
12) marketIndicators must reference indexId from the provided market index list.
13) If a previous brief is provided, deltaSinceLastRun should be concrete changes only and should not duplicate impact language.
14) Selected article summaries must explain what happened, why it matters for the category, and what to watch next in direct plain English.
15) Never paste article leads, page navigation text, bylines, or boilerplate from the source.
16) selectedArticles.briefContent must be 2-4 sentences in normal English:
    - sentence 1: what happened
    - sentence 2: the most important concrete detail, timing, scope, or constraint
    - optional sentence 3 or 4: what this means or what to watch next
17) selectedArticles.categoryImportance must be specific to this portfolio/category. Do not use generic filler such as "signal relevance for sourcing..."
18) selectedArticles.keyMetrics must be 1-4 short readable fact lines with context, not bare numbers.
    Good: "14-day drilling program", "Targets 1,430m measured depth", "First of three planned 2026 prospects"
    Bad: "14", "1,430", "2026", "recent update"
19) Summary bullets must not simply restate headlines. Write what a busy adult should actually take away.
20) If an article is weak, thematic, or peripheral, say so. Do not force it to sound more operational than it is.

JSON SHAPE:
\`\`\`json
{
  "title": "Headline title",
  "summaryBullets": [{ "text": "bullet", "citations": [1], "signal": "confirmed" }],
  "deltaSinceLastRun": ["Concrete delta vs prior run"],
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
    {
      "articleIndex": 1,
      "briefContent": "The company started a 14-day drilling program on a new gas well in Austria. The work targets 1,430m measured depth and is the first of three planned 2026 prospects, which makes this more than a one-off operational update. Watch whether the next two wells proceed on the same cadence.",
      "categoryImportance": "For this category, the useful read-through is near-term demand around active drilling scopes and a reminder that operators with multi-well sequences tend to tighten execution expectations quickly.",
      "keyMetrics": ["14-day drilling program", "Targets 1,430m measured depth", "First of three planned 2026 prospects"],
      "imageAlt": "alt"
    }
  ],
  "heroSelection": { "articleIndex": 1 },
  "marketIndicators": [{ "indexId": "some-id", "note": "procurement implication" }]
}
\`\`\`

Context:
- Portfolio: ${input.agent.label}
- Region: ${regionLabel}
- Run window: ${input.runWindow.toUpperCase()}
- Coverage mode: ${coverageMode}

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
    issues.push("Impact must contain 6-12 bullets total");
  }

  const actionCount =
    output.possibleActions.next72Hours.length +
    output.possibleActions.next2to4Weeks.length +
    output.possibleActions.nextQuarter.length;
  if (actionCount < ACTIONS_MIN_TOTAL || actionCount > ACTIONS_MAX_TOTAL) {
    issues.push("Possible actions must contain 3-7 actions total");
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

function normalizeCitations(citations: number[], selectedSet: Set<number>): number[] {
  const normalized = Array.from(new Set(citations.filter((citation) => selectedSet.has(citation))));
  if (normalized.length === 0) return [];
  return normalized.slice(0, CITATION_LIST_LIMIT);
}

function dedupeSectionsByText(output: ProcurementOutput): void {
  const seen = new Set<string>();

  const filterBullets = (
    bullets: Array<{ text: string; citations: number[]; signal?: "confirmed" | "early-signal" | "unconfirmed" }>
  ): typeof bullets => {
    const out: typeof bullets = [];
    for (const bullet of bullets) {
      const normalized = normalizeComparableText(bullet.text);
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      out.push(bullet);
    }
    return out;
  };

  output.summaryBullets = filterBullets(output.summaryBullets);
  output.impact.marketCostDrivers = filterBullets(output.impact.marketCostDrivers);
  output.impact.supplyBaseCapacity = filterBullets(output.impact.supplyBaseCapacity);
  output.impact.contractingCommercialTerms = filterBullets(output.impact.contractingCommercialTerms);
  output.impact.riskRegulatoryOperationalConstraints = filterBullets(output.impact.riskRegulatoryOperationalConstraints);
  output.deltaSinceLastRun = (output.deltaSinceLastRun ?? [])
    .filter((item) => {
      const normalized = normalizeComparableText(item);
      if (!normalized || seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    })
    .slice(0, 3);
}

function normalizeImpactCount(impact: ProcurementOutput["impact"], selectedSet: Set<number>): void {
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
        citations: normalizeCitations(group[idx].citations, selectedSet)
      };
    }
  }

  const totalCount = () => groups.reduce((sum, group) => sum + group.length, 0);

  let guard = 0;
  while (totalCount() < IMPACT_MIN_BULLETS && guard < 64) {
    guard += 1;
    const group =
      groups
        .filter((g) => g.length < 4)
        .sort((a, b) => a.length - b.length)[0] ?? groups[0];
    const seed = group[group.length - 1] ?? groups[0][0];
    group.push({
      ...seed,
      citations: normalizeCitations(seed.citations, selectedSet)
    });
  }

  guard = 0;
  while (totalCount() > IMPACT_MAX_BULLETS && guard < 64) {
    guard += 1;
    const group =
      groups
        .filter((g) => g.length > 1)
        .sort((a, b) => b.length - a.length)[0] ?? groups[0];
    if (group.length <= 1) break;
    group.pop();
  }
}

function normalizeActionCount(possibleActions: ProcurementOutput["possibleActions"], selectedSet: Set<number>): void {
  const groups = [
    { items: possibleActions.next72Hours, min: 1, max: 3 },
    { items: possibleActions.next2to4Weeks, min: 1, max: 3 },
    { items: possibleActions.nextQuarter, min: 1, max: 3 }
  ];

  for (const group of groups) {
    for (let idx = 0; idx < group.items.length; idx += 1) {
      group.items[idx] = {
        ...group.items[idx],
        citations: normalizeCitations(group.items[idx].citations, selectedSet)
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
      citations: normalizeCitations(seed.citations, selectedSet)
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
      citations: normalizeCitations(bullet.citations, selectedSet)
    })),
    impact: {
      marketCostDrivers: output.impact.marketCostDrivers.map((bullet) => ({
        ...bullet,
        citations: normalizeCitations(bullet.citations, selectedSet)
      })),
      supplyBaseCapacity: output.impact.supplyBaseCapacity.map((bullet) => ({
        ...bullet,
        citations: normalizeCitations(bullet.citations, selectedSet)
      })),
      contractingCommercialTerms: output.impact.contractingCommercialTerms.map((bullet) => ({
        ...bullet,
        citations: normalizeCitations(bullet.citations, selectedSet)
      })),
      riskRegulatoryOperationalConstraints: output.impact.riskRegulatoryOperationalConstraints.map((bullet) => ({
        ...bullet,
        citations: normalizeCitations(bullet.citations, selectedSet)
      }))
    },
    possibleActions: {
      next72Hours: output.possibleActions.next72Hours.map((action) => ({
        ...action,
        citations: normalizeCitations(action.citations, selectedSet)
      })),
      next2to4Weeks: output.possibleActions.next2to4Weeks.map((action) => ({
        ...action,
        citations: normalizeCitations(action.citations, selectedSet)
      })),
      nextQuarter: output.possibleActions.nextQuarter.map((action) => ({
        ...action,
        citations: normalizeCitations(action.citations, selectedSet)
      }))
    }
  };

  dedupeSectionsByText(normalized);
  normalizeImpactCount(normalized.impact, selectedSet);
  normalizeActionCount(normalized.possibleActions, selectedSet);
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
