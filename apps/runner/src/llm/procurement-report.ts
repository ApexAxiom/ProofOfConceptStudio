import { z } from "zod";
import {
  AgentConfig,
  BriefV2NewsStatus,
  MarketIndex,
  RegionSlug,
  RunWindow,
  REGIONS,
  SelectedArticleProcurementLens,
  getAgentFramework
} from "@proof/shared";
import type { ArticleInput } from "./prompts.js";
import {
  hasUnsupportedQuantifiedProcurementClaim,
  isWeakProcurementLensText,
  normalizeLensComparableText
} from "./procurement-lens.js";

export interface ProcurementPromptInput {
  agent: AgentConfig;
  region: RegionSlug;
  runWindow: RunWindow;
  articles: ArticleInput[];
  indices: MarketIndex[];
  newsStatus?: BriefV2NewsStatus;
  model?: string;
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
    costMoney: ProcurementOutputBullet[];
    supplierCommercial: ProcurementOutputBullet[];
    safetyOperations: ProcurementOutputBullet[];
    watchouts: ProcurementOutputBullet[];
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
    procurementLens: SelectedArticleProcurementLens;
  }>;
  heroSelection: { articleIndex: number };
  marketIndicators: Array<{ indexId: string; note: string }>;
}

const SIGNAL_ENUM = z.enum(["confirmed", "early-signal", "unconfirmed"]);
const OWNER_ENUM = z.enum(["Category", "Contracts", "Legal", "Ops"]);
const PROCUREMENT_SIGNAL_STRENGTH_ENUM = z.enum(["strong", "moderate", "limited"]);
const PROCUREMENT_INFERENCE_MODE_ENUM = z.enum(["source-grounded", "directional"]);
const OUTPUT_SUMMARY_MAX_BULLETS = 3;
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
  action: z.string().min(8).max(140),
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

const procurementLensTextSchema = z.string().min(24).max(320);
const procurementLensSchema = z.object({
  buyerTakeaway: procurementLensTextSchema,
  costMoney: procurementLensTextSchema,
  supplierCommercial: procurementLensTextSchema,
  safetyOperational: procurementLensTextSchema,
  watchouts: procurementLensTextSchema,
  signalStrength: PROCUREMENT_SIGNAL_STRENGTH_ENUM,
  inferenceMode: PROCUREMENT_INFERENCE_MODE_ENUM
}).superRefine((value, context) => {
  const entries = Object.entries(value).filter(([key]) => key !== "signalStrength" && key !== "inferenceMode") as Array<
    [Exclude<keyof SelectedArticleProcurementLens, "signalStrength" | "inferenceMode">, string]
  >;
  const seen = new Map<string, string>();
  for (const [field, text] of entries) {
    if (isWeakProcurementLensText(text)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `selectedArticles.procurementLens.${field} must be specific, not placeholder text`,
        path: [field]
      });
    }
    if (hasUnsupportedQuantifiedProcurementClaim(text)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `selectedArticles.procurementLens.${field} includes an unsupported quantified procurement claim`,
        path: [field]
      });
    }
    const comparable = normalizeLensComparableText(text);
    if (seen.has(comparable)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `selectedArticles.procurementLens.${field} must add a distinct lens, not repeat ${seen.get(comparable)}`,
        path: [field]
      });
    } else {
      seen.set(comparable, field);
    }
  }
});

const outputSchema = z.object({
  title: z.string().min(8).max(160),
  summaryBullets: z.array(citedBulletSchema).min(1).max(OUTPUT_SUMMARY_MAX_BULLETS),
  impact: z.object({
    costMoney: z.array(citedBulletSchema).min(1).max(4),
    supplierCommercial: z.array(citedBulletSchema).min(1).max(4),
    safetyOperations: z.array(citedBulletSchema).min(1).max(4),
    watchouts: z.array(citedBulletSchema).min(1).max(4)
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
        imageAlt: z.string().min(3).max(180).optional(),
        procurementLens: procurementLensSchema
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
        if (normalizeLensComparableText(value.briefContent) === normalizeLensComparableText(value.categoryImportance)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "selectedArticles.briefContent and categoryImportance must not repeat the same sentence"
          });
        }
        if (normalizeLensComparableText(value.categoryImportance) === normalizeLensComparableText(value.procurementLens.buyerTakeaway)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "selectedArticles.categoryImportance must sharpen the buyer bottom line, not repeat procurementLens.buyerTakeaway"
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
    .max(5),
  heroSelection: z.object({ articleIndex: z.number().int().positive() }),
  marketIndicators: z.array(z.object({ indexId: z.string().min(2), note: z.string().min(8).max(240) })).min(2).max(8)
});

const TITLE_MIN_WORDS = 8;
const TITLE_MAX_WORDS = 14;
const IMPACT_MIN_BULLETS = 1;
const IMPACT_MAX_BULLETS = 9;
const ACTIONS_MIN_TOTAL = 1;
const ACTIONS_MAX_TOTAL = 3;

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
      const eventType = article.eventLabel ? `\nEvent type: ${article.eventLabel}` : "";
      const entities = article.entities?.length
        ? `\nKnown suppliers/operators mentioned: ${article.entities.join(", ")}`
        : "";
      const covered = article.previouslyCovered
        ? "\nNOTE: A similar story ran in a recent brief for this category. Only feature it if there is a genuinely new development, and frame it as an update (what changed), not as news."
        : "";
      return [
        `### Article ${index}${sourceName}`,
        `Title: ${article.title}`,
        `URL: ${article.url}`,
        published,
        contentStatus,
        eventType,
        entities,
        covered,
        "Evidence excerpts:",
        extractEvidenceExcerpts(article.content ?? "")
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n---\n\n");
}

function categoryFrameworkBlock(input: ProcurementPromptInput): string {
  const framework = getAgentFramework(input.agent.id);
  if (!framework) return "";
  const lens = framework.dailyCMLens;
  const lines = [
    framework.keySuppliers.length ? `- Key suppliers in this category: ${framework.keySuppliers.join(", ")}` : "",
    framework.marketDrivers.length ? `- Market drivers: ${framework.marketDrivers.join("; ")}` : "",
    lens?.costDrivers?.length ? `- Cost drivers to read prices through: ${lens.costDrivers.join("; ")}` : "",
    lens?.capacityDrivers?.length ? `- Capacity drivers to read availability through: ${lens.capacityDrivers.join("; ")}` : "",
    lens?.contractingImplications?.length
      ? `- Contract mechanisms that matter here: ${lens.contractingImplications.join("; ")}`
      : "",
    lens?.complianceTriggers?.length ? `- Compliance triggers to flag: ${lens.complianceTriggers.join("; ")}` : ""
  ].filter(Boolean);
  if (lines.length === 0) return "";
  return `Category framework (use this lens when judging relevance and writing implications; never invent facts from it):
${lines.join("\n")}`;
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

  return `You are generating a professional category-manager decision memo for ${input.agent.label}.

Your audience is a working category manager who needs a clean decision memo, not a news digest.
Keep the intelligence and sourcing insight, but write in full sentences with no filler, no duplicated ideas, and no visible truncation.
Do not dumb it down. Explain concrete commercial mechanisms instead of vague phrases like "market dynamics", "may impact", or "could affect".
If you use industry jargon or an acronym, make the meaning obvious in context.

OUTPUT RULES (strict):
1) Return JSON only.
2) Title must be 8-14 words, strong verb, not generic, never includes "Daily Brief".
3) Write like a category-management analyst preparing a decision memo, not a press release or newswire.
4) If today's signal is light, say so directly and calmly. Do not manufacture urgency.
5) Produce a lean memo structure:
   - Summary: 1-3 cited bullets. These are the key takeaways and must not repeat the title or top action.
   - Impact: 1-9 cited bullets across no more than these subgroups:
      * costMoney
      * supplierCommercial
      * safetyOperations
      * watchouts only when it is not already covered by action or risk language
   - Possible actions: 1-3 actions total across:
      * next72Hours (rendered as Do now; only use for concrete near-term actions)
      * next2to4Weeks (rendered as Next few weeks)
      * nextQuarter (rendered as Watch; use for monitor/prepare items, not filler)
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
14) Think like a category manager or supply-chain specialist, not a general news summarizer.
15) Use procurement mechanisms whenever they are supported by the article:
    - headcount or travel reduction
    - offshore or onsite staffing exposure
    - uptime or execution dependency
    - connectivity or cyber dependency
    - supplier leverage or pricing posture
    - contract scope, term, or pass-through implications
    - safety improvement or degradation
    - risk transfer between buyer and supplier
16) Selected article summaries must explain what happened, what makes it operationally real, and what to watch next in direct plain English.
17) Every selected article MUST include procurementLens with:
    - buyerTakeaway
    - costMoney
    - supplierCommercial
    - safetyOperational
    - watchouts
    - signalStrength = strong|moderate|limited
    - inferenceMode = source-grounded|directional
 18) selectedArticles.briefContent must be 2-4 sentences in normal English:
    - sentence 1: what happened
    - sentence 2: the most important concrete detail, timing, scope, or constraint
    - optional sentence 3 or 4: what this means or what to watch next
19) selectedArticles.categoryImportance is the one-line buyer bottom line for backward compatibility. It must be category-specific and sharper than the title.
20) selectedArticles.keyMetrics must be 1-4 short readable fact lines with context, not bare numbers.
    Good: "14-day drilling program", "Targets 1,430m measured depth", "First of three planned 2026 prospects"
    Bad: "14", "1,430", "2026", "recent update"
 21) Summary bullets must not simply restate headlines. Write procurement outcomes, not article titles.
22) No headline restatement as insight. No generic wording like "this matters for the category."
23) No invented savings, ROI, payback, or risk numbers. Directional inference is allowed only when the mechanism is clear from the source.
24) No fake urgency on light-signal days.
25) If an article is weak, thematic, or peripheral, say so directly. Limited relevance is acceptable.
26) Never paste article leads, page navigation text, bylines, or boilerplate from the source.
27) Name the suppliers, operators, and counterparties involved whenever the article identifies them. "A major contractor" is weaker than "Subsea 7". Use the "Event type" and "Known suppliers/operators mentioned" hints on each article to anchor the procurement angle.
 28) Use the category framework below to judge relevance and phrase implications in this category's commercial language (e.g. dayrate/term for rigs, steel-indexed pricing for OCTG, escalation indices for LTSAs). Never present framework entries as facts from today's articles.
 29) Do not use "..." or a unicode ellipsis in any visible field.
 30) Action labels must be crisp commands under 140 characters. Put the reason in rationale and the result in expectedOutcome.
 31) Do not repeat the same normalized sentence across summaryBullets, impact, possibleActions, deltaSinceLastRun, selectedArticles, or procurementLens.

JSON SHAPE:
\`\`\`json
{
  "title": "Headline title",
  "summaryBullets": [{ "text": "bullet", "citations": [1], "signal": "confirmed" }],
  "deltaSinceLastRun": ["Concrete delta vs prior run"],
  "impact": {
    "costMoney": [{ "text": "bullet", "citations": [1] }],
    "supplierCommercial": [{ "text": "bullet", "citations": [2] }],
    "safetyOperations": [{ "text": "bullet", "citations": [1,2] }],
    "watchouts": [{ "text": "bullet", "citations": [3], "signal": "early-signal" }]
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
      "categoryImportance": "Buyer bottom line: active multi-well programs usually tighten supplier responsiveness and reduce slack around mobilization and support scopes.",
      "keyMetrics": ["14-day drilling program", "Targets 1,430m measured depth", "First of three planned 2026 prospects"],
      "imageAlt": "alt",
      "procurementLens": {
        "buyerTakeaway": "Treat this as a real demand signal, not a one-off headline, because multi-well sequences often harden execution expectations quickly.",
        "costMoney": "The cost read-through is directional: tighter rig cadence can increase mobilization pressure and reduce buyer room to wait for better pricing.",
        "supplierCommercial": "Suppliers tied to drilling support may gain leverage on timing, availability, and short-validity quotes before the next wells start.",
        "safetyOperational": "Operationally, faster cadence can compress readiness windows if crews, equipment, or permits are not aligned ahead of time.",
        "watchouts": "Watch whether the follow-on wells keep the same pace and whether suppliers start narrowing commitment windows.",
        "signalStrength": "strong",
        "inferenceMode": "source-grounded"
      }
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

${categoryFrameworkBlock(input)}

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
    ...output.impact.costMoney.flatMap((item) => item.citations),
    ...output.impact.supplierCommercial.flatMap((item) => item.citations),
    ...output.impact.safetyOperations.flatMap((item) => item.citations),
    ...output.impact.watchouts.flatMap((item) => item.citations),
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
    output.impact.costMoney.length +
    output.impact.supplierCommercial.length +
    output.impact.safetyOperations.length +
    output.impact.watchouts.length;
  if (impactCount < IMPACT_MIN_BULLETS || impactCount > IMPACT_MAX_BULLETS) {
    issues.push(`Impact must contain ${IMPACT_MIN_BULLETS}-${IMPACT_MAX_BULLETS} bullets total`);
  }

  const actionCount =
    output.possibleActions.next72Hours.length +
    output.possibleActions.next2to4Weeks.length +
    output.possibleActions.nextQuarter.length;
  if (actionCount < ACTIONS_MIN_TOTAL || actionCount > ACTIONS_MAX_TOTAL) {
    issues.push(`Possible actions must contain ${ACTIONS_MIN_TOTAL}-${ACTIONS_MAX_TOTAL} actions total`);
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
        "Maintain supplier optionality, contract flexibility, and active risk monitoring until category-specific signal depth improves.",
      procurementLens: {
        buyerTakeaway:
          "Treat this as a light-signal day. The useful buyer move is to stay alert without forcing a big sourcing conclusion from weak evidence.",
        costMoney:
          "There is no defensible savings or cost-reset number here, but weak coverage still argues for keeping budgets and quotes under review.",
        supplierCommercial:
          "Keep supplier conversations open and contract assumptions flexible until category-specific signal depth improves.",
        safetyOperational:
          "No direct operating shift is confirmed here, so use this mainly as a prompt to verify readiness rather than escalate risk.",
        watchouts:
          "Watch for stronger category-specific evidence in the next cycle before making a large commercial or operational call.",
        signalStrength: "limited",
        inferenceMode: "directional"
      }
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
      const normalized = normalizeLensComparableText(bullet.text);
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      out.push(bullet);
    }
    return out;
  };

  output.summaryBullets = filterBullets(output.summaryBullets);
  output.impact.costMoney = filterBullets(output.impact.costMoney);
  output.impact.supplierCommercial = filterBullets(output.impact.supplierCommercial);
  output.impact.safetyOperations = filterBullets(output.impact.safetyOperations);
  output.impact.watchouts = filterBullets(output.impact.watchouts);

  const filterActions = (actions: ProcurementOutputAction[]): ProcurementOutputAction[] => {
    const out: ProcurementOutputAction[] = [];
    for (const action of actions) {
      const normalized = normalizeLensComparableText(action.action);
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      out.push(action);
    }
    return out;
  };

  output.possibleActions.next72Hours = filterActions(output.possibleActions.next72Hours);
  output.possibleActions.next2to4Weeks = filterActions(output.possibleActions.next2to4Weeks);
  output.possibleActions.nextQuarter = filterActions(output.possibleActions.nextQuarter);

  output.deltaSinceLastRun = (output.deltaSinceLastRun ?? [])
    .filter((item) => {
      const normalized = normalizeLensComparableText(item);
      if (!normalized || seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    })
    .slice(0, 3);
}

function hasVisibleEllipsis(value: string): boolean {
  return /\.\.\.|…/.test(value);
}

function collectVisibleStrings(output: ProcurementOutput): Array<{ path: string; value: string }> {
  const rows: Array<{ path: string; value: string }> = [
    { path: "title", value: output.title },
    ...(output.deltaSinceLastRun ?? []).map((value, idx) => ({ path: `deltaSinceLastRun[${idx}]`, value })),
    ...output.summaryBullets.map((item, idx) => ({ path: `summaryBullets[${idx}].text`, value: item.text })),
    ...output.impact.costMoney.map((item, idx) => ({ path: `impact.costMoney[${idx}].text`, value: item.text })),
    ...output.impact.supplierCommercial.map((item, idx) => ({ path: `impact.supplierCommercial[${idx}].text`, value: item.text })),
    ...output.impact.safetyOperations.map((item, idx) => ({ path: `impact.safetyOperations[${idx}].text`, value: item.text })),
    ...output.impact.watchouts.map((item, idx) => ({ path: `impact.watchouts[${idx}].text`, value: item.text })),
    ...output.possibleActions.next72Hours.flatMap((item, idx) => [
      { path: `possibleActions.next72Hours[${idx}].action`, value: item.action },
      { path: `possibleActions.next72Hours[${idx}].rationale`, value: item.rationale },
      { path: `possibleActions.next72Hours[${idx}].expectedOutcome`, value: item.expectedOutcome }
    ]),
    ...output.possibleActions.next2to4Weeks.flatMap((item, idx) => [
      { path: `possibleActions.next2to4Weeks[${idx}].action`, value: item.action },
      { path: `possibleActions.next2to4Weeks[${idx}].rationale`, value: item.rationale },
      { path: `possibleActions.next2to4Weeks[${idx}].expectedOutcome`, value: item.expectedOutcome }
    ]),
    ...output.possibleActions.nextQuarter.flatMap((item, idx) => [
      { path: `possibleActions.nextQuarter[${idx}].action`, value: item.action },
      { path: `possibleActions.nextQuarter[${idx}].rationale`, value: item.rationale },
      { path: `possibleActions.nextQuarter[${idx}].expectedOutcome`, value: item.expectedOutcome }
    ])
  ];

  output.selectedArticles.forEach((article, idx) => {
    rows.push(
      { path: `selectedArticles[${idx}].briefContent`, value: article.briefContent },
      { path: `selectedArticles[${idx}].categoryImportance`, value: article.categoryImportance },
      ...((article.keyMetrics ?? []).map((value, metricIdx) => ({ path: `selectedArticles[${idx}].keyMetrics[${metricIdx}]`, value }))),
      { path: `selectedArticles[${idx}].procurementLens.buyerTakeaway`, value: article.procurementLens.buyerTakeaway },
      { path: `selectedArticles[${idx}].procurementLens.costMoney`, value: article.procurementLens.costMoney },
      { path: `selectedArticles[${idx}].procurementLens.supplierCommercial`, value: article.procurementLens.supplierCommercial },
      { path: `selectedArticles[${idx}].procurementLens.safetyOperational`, value: article.procurementLens.safetyOperational },
      { path: `selectedArticles[${idx}].procurementLens.watchouts`, value: article.procurementLens.watchouts }
    );
  });

  return rows;
}

function validateVisibleMemoQuality(output: ProcurementOutput): string[] {
  const issues: string[] = [];
  for (const row of collectVisibleStrings(output)) {
    if (hasVisibleEllipsis(row.value)) {
      issues.push(`${row.path} must not contain ellipses`);
    }
  }
  for (const action of [
    ...output.possibleActions.next72Hours,
    ...output.possibleActions.next2to4Weeks,
    ...output.possibleActions.nextQuarter
  ]) {
    if (action.action.length > 140) {
      issues.push(`Action label exceeds 140 characters: ${action.action.slice(0, 80)}`);
    }
  }
  return issues;
}

function normalizeImpactCount(impact: ProcurementOutput["impact"], selectedSet: Set<number>): void {
  const groups = [
    impact.costMoney,
    impact.supplierCommercial,
    impact.safetyOperations,
    impact.watchouts
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
    const seed = group[group.length - 1] ?? groups.find((candidate) => candidate.length > 0)?.[0];
    if (!seed) break;
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
    { items: possibleActions.next72Hours, min: 0, max: 3 },
    { items: possibleActions.next2to4Weeks, min: 0, max: 3 },
    { items: possibleActions.nextQuarter, min: 0, max: 3 }
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
      costMoney: output.impact.costMoney.map((bullet) => ({
        ...bullet,
        citations: normalizeCitations(bullet.citations, selectedSet)
      })),
      supplierCommercial: output.impact.supplierCommercial.map((bullet) => ({
        ...bullet,
        citations: normalizeCitations(bullet.citations, selectedSet)
      })),
      safetyOperations: output.impact.safetyOperations.map((bullet) => ({
        ...bullet,
        citations: normalizeCitations(bullet.citations, selectedSet)
      })),
      watchouts: output.impact.watchouts.map((bullet) => ({
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
  const visibleIssues = validateVisibleMemoQuality(output);
  if (visibleIssues.length > 0) {
    throw new Error(JSON.stringify(visibleIssues));
  }
  return output;
}
