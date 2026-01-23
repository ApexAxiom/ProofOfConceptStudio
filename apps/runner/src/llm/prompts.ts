import {
  AgentConfig,
  CmSnapshot,
  MarketIndex,
  RegionSlug,
  RunWindow,
  VpSnapshot,
  VpConfidence,
  VpHorizon,
  VpSignalType,
  REGIONS
} from "@proof/shared";
import { getWritingInstructions, getCitationInstructions, getImageInstructions, WRITING_GUIDE } from "./writing-guide.js";
import { getCategoryManagerPersona, getCategorySelectionGuidance, getCategoryBriefStructure } from "./category-manager-prompt.js";

/**
 * Formats a date string to region-specific timezone (CST for us-mx-la-lng, AWST for au)
 */
function formatDateForRegion(dateStr: string, region: RegionSlug): string {
  const date = new Date(dateStr);
  const timeZone = REGIONS[region].timeZone;
  const timeZoneLabel = region === "au" ? "AWST" : "CST";
  
  return date.toLocaleString("en-US", {
    timeZone,
    dateStyle: "medium",
    timeStyle: "short",
    hour12: true
  }) + ` ${timeZoneLabel}`;
}

/**
 * Formats a date string to region-specific timezone for article dates (date only)
 */
function formatArticleDateForRegion(dateStr: string, region: RegionSlug): string {
  const date = new Date(dateStr);
  const timeZone = REGIONS[region].timeZone;
  const timeZoneLabel = region === "au" ? "AWST" : "CST";
  
  return date.toLocaleDateString("en-US", {
    timeZone,
    dateStyle: "medium"
  }) + ` ${timeZoneLabel}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function extractEvidenceExcerpts(content: string): string {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (!normalized) return "- [No content available]";

  const sentences = normalized.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [];
  const excerpts: string[] = [];
  const seen = new Set<string>();

  const addSentence = (sentence: string) => {
    const trimmed = sentence.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    const clipped = trimmed.length > 300 ? `${trimmed.slice(0, 297)}...` : trimmed;
    excerpts.push(`- ${clipped}`);
  };

  // Extract first 8 sentences (increased from 3 for more context)
  sentences.slice(0, 8).forEach(addSentence);

  // Extract ALL sentences with numeric data (critical for category management insights)
  const numericRegex = /(\d|%|\$|€|£|¥|million|billion|kb\/d|bpd|mbpd|mmbtu|tcf|bcf|contract|price|cost|rate|capacity|production|reserve)/i;
  sentences.filter((s) => numericRegex.test(s)).forEach(addSentence);

  // Extract ALL sentences mentioning suppliers/companies (critical for procurement insights)
  const supplierRegex = /\b(Inc|Ltd|LLC|Corp|Corporation|Company|Co\.|Group|Holdings|Energy|Oil|Gas|Services|Technologies|International|Global|Partners|Solutions|Systems)\b/i;
  sentences.filter((s) => supplierRegex.test(s)).forEach(addSentence);

  // Extract sentences with key procurement/category terms
  const categoryTermsRegex = /\b(contract|award|deal|agreement|procurement|sourcing|supplier|vendor|negotiation|tender|bid|RFP|RFQ|purchase|acquisition|merger|partnership|joint venture|collaboration)\b/i;
  sentences.filter((s) => categoryTermsRegex.test(s)).slice(0, 10).forEach(addSentence);

  // Extract sentences with market/industry impact terms
  const impactTermsRegex = /\b(market|demand|supply|shortage|surplus|capacity|expansion|growth|decline|increase|decrease|surge|plunge|spike|drop|rise|fall|trend|forecast|outlook|projection)\b/i;
  sentences.filter((s) => impactTermsRegex.test(s)).slice(0, 8).forEach(addSentence);

  // Return up to 40 excerpts (increased from 10 for much richer context)
  return excerpts.slice(0, 40).join("\n");
}

export function requiredArticleCount(agent: AgentConfig): number {
  // Allow dashboard-style briefs to include broader coverage (e.g. 6 category groups).
  // Most category briefs still use the default of 3.
  return clamp(agent.articlesPerRun ?? WRITING_GUIDE.articleSelection.count, 1, 8);
}

export interface ArticleInput {
  title: string;
  url: string;
  content?: string;
  ogImageUrl?: string;
  sourceName?: string;
  publishedAt?: string;
  contentStatus?: "ok" | "thin";
}

export interface PromptInput {
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

/**
 * Expected JSON output structure from the LLM
 */
export interface BriefOutput {
  title: string;
  summary: string;
  highlights?: string[];
  procurementActions?: string[];
  watchlist?: string[];
  deltaSinceLastRun?: string[];
  decisionSummary?: {
    topMove: string;
    whatChanged?: string[];
    doNext?: string[];
    watchThisWeek?: string[];
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
  vpSnapshot?: VpSnapshot;
  cmSnapshot?: CmSnapshot;
}

function sanitizeStringArray(value: unknown, maxItems = 10): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0)
    .slice(0, maxItems);
}

function sanitizeDecisionSummary(raw: any): BriefOutput["decisionSummary"] {
  if (!raw || typeof raw !== "object") return undefined;
  const topMove = typeof raw.topMove === "string" ? raw.topMove.trim() : "";
  const whatChanged = sanitizeStringArray(raw.whatChanged, 3);
  const doNext = sanitizeStringArray(raw.doNext, 5);
  const watchThisWeek = sanitizeStringArray(raw.watchThisWeek, 4);

  if (!topMove && whatChanged.length === 0 && doNext.length === 0 && watchThisWeek.length === 0) {
    return undefined;
  }

  return {
    topMove,
    whatChanged,
    doNext,
    watchThisWeek
  };
}
function clampScore(value: unknown): number | undefined {
  const num = Number(value);
  if (!Number.isFinite(num)) return undefined;
  return Math.round(clamp(num, 0, 100));
}

function sanitizeConfidence(value: unknown): VpConfidence | undefined {
  const allowed: VpConfidence[] = ["low", "medium", "high"];
  if (typeof value === "string" && allowed.includes(value as VpConfidence)) return value as VpConfidence;
  return undefined;
}

function sanitizeHorizon(value: unknown): VpHorizon | undefined {
  const allowed: VpHorizon[] = ["0-30d", "30-180d", "180d+"];
  if (typeof value === "string" && allowed.includes(value as VpHorizon)) return value as VpHorizon;
  return undefined;
}

function sanitizeSignalType(value: unknown): VpSignalType | undefined {
  const allowed: VpSignalType[] = ["cost", "supply", "schedule", "regulatory", "supplier", "commercial"];
  if (typeof value === "string" && allowed.includes(value as VpSignalType)) return value as VpSignalType;
  return undefined;
}

function sanitizeCmSnapshot(raw: any, selectedIndices: Set<number>): CmSnapshot | undefined {
  if (!raw || typeof raw !== "object") return undefined;

  const toStr = (value: unknown) => (typeof value === "string" ? value.trim() : "");
  const validEvidenceIndex = (value: unknown): number | undefined => {
    const num = Number(value);
    if (!Number.isInteger(num)) return undefined;
    if (!selectedIndices.has(num)) return undefined;
    return num;
  };

  type SanitizedPriority = {
    title: string;
    why: string;
    dueInDays: number;
    confidence: VpConfidence;
    evidenceArticleIndex: number;
  };

  type SanitizedSupplierSignal = {
    supplier: string;
    signal: string;
    implication: string;
    nextStep: string;
    confidence: VpConfidence;
    evidenceArticleIndex: number;
  };

  type SanitizedLever = {
    lever: string;
    whenToUse: string;
    expectedOutcome: string;
    confidence: VpConfidence;
    evidenceArticleIndex: number;
  };

  const sanitizePriority = (item: unknown): SanitizedPriority | null => {
    if (!item || typeof item !== "object") return null;
    const typedItem = item as { [key: string]: unknown };
    const evidenceArticleIndex = validEvidenceIndex(typedItem.evidenceArticleIndex);
    if (evidenceArticleIndex === undefined) return null;

    const title = toStr(typedItem.title);
    const why = toStr(typedItem.why);
    if (!title && !why) return null;

    const due = clamp(Number(typedItem.dueInDays) || 0, 1, 30);

    return {
      title,
      why,
      dueInDays: Math.round(due),
      confidence: sanitizeConfidence(typedItem.confidence) ?? "medium",
      evidenceArticleIndex
    };
  };

  const sanitizeSupplierSignal = (item: unknown): SanitizedSupplierSignal | null => {
    if (!item || typeof item !== "object") return null;
    const typedItem = item as { [key: string]: unknown };
    const evidenceArticleIndex = validEvidenceIndex(typedItem.evidenceArticleIndex);
    if (evidenceArticleIndex === undefined) return null;

    const supplier = toStr(typedItem.supplier);
    const signal = toStr(typedItem.signal);
    const implication = toStr(typedItem.implication);
    const nextStep = toStr(typedItem.nextStep);
    if (!supplier && !signal && !nextStep && !implication) return null;

    return {
      supplier,
      signal,
      implication,
      nextStep,
      confidence: sanitizeConfidence(typedItem.confidence) ?? "medium",
      evidenceArticleIndex
    };
  };

  const sanitizeLever = (item: unknown): SanitizedLever | null => {
    if (!item || typeof item !== "object") return null;
    const typedItem = item as { [key: string]: unknown };
    const evidenceArticleIndex = validEvidenceIndex(typedItem.evidenceArticleIndex);
    if (evidenceArticleIndex === undefined) return null;

    const lever = toStr(typedItem.lever);
    const whenToUse = toStr(typedItem.whenToUse);
    const expectedOutcome = toStr(typedItem.expectedOutcome);
    if (!lever && !whenToUse && !expectedOutcome) return null;

    return {
      lever,
      whenToUse,
      expectedOutcome,
      confidence: sanitizeConfidence(typedItem.confidence) ?? "medium",
      evidenceArticleIndex
    };
  };

  const todayPriorities = Array.isArray(raw.todayPriorities)
    ? (raw.todayPriorities as unknown[])
        .map(sanitizePriority)
        .filter((item): item is SanitizedPriority => Boolean(item))
        .slice(0, 6)
    : [];

  const supplierRadar = Array.isArray(raw.supplierRadar)
    ? (raw.supplierRadar as unknown[])
        .map(sanitizeSupplierSignal)
        .filter((item): item is SanitizedSupplierSignal => Boolean(item))
        .slice(0, 6)
    : [];

  const negotiationLevers = Array.isArray(raw.negotiationLevers)
    ? (raw.negotiationLevers as unknown[])
        .map(sanitizeLever)
        .filter((item): item is SanitizedLever => Boolean(item))
        .slice(0, 6)
    : [];

  const intelGaps = sanitizeStringArray(raw.intelGaps, 5);
  const talkingPoints = sanitizeStringArray(raw.talkingPoints, 6);

  if (
    todayPriorities.length === 0 &&
    supplierRadar.length === 0 &&
    negotiationLevers.length === 0 &&
    intelGaps.length === 0 &&
    talkingPoints.length === 0
  ) {
    return undefined;
  }

  return {
    todayPriorities,
    supplierRadar,
    negotiationLevers,
    intelGaps: intelGaps.length ? intelGaps : undefined,
    talkingPoints: talkingPoints.length ? talkingPoints : undefined
  };
}

function sanitizeVpSnapshot(raw: any, selectedIndices: Set<number>): VpSnapshot | undefined {
  if (!raw || typeof raw !== "object" || !raw.health) return undefined;

  const healthRaw = raw.health ?? {};
  const health = {
    overall: clampScore(healthRaw.overall) ?? 0,
    costPressure: clampScore(healthRaw.costPressure) ?? 0,
    supplyRisk: clampScore(healthRaw.supplyRisk) ?? 0,
    scheduleRisk: clampScore(healthRaw.scheduleRisk) ?? 0,
    complianceRisk: clampScore(healthRaw.complianceRisk) ?? 0,
    narrative: typeof healthRaw.narrative === "string" ? healthRaw.narrative : ""
  };

  const validEvidenceIndex = (value: unknown): number | undefined => {
    const num = Number(value);
    if (!Number.isInteger(num)) return undefined;
    if (!selectedIndices.has(num)) return undefined;
    return num;
  };

  const allowedOwnerRoles = new Set([
    "Category Manager",
    "SRM",
    "Contracts",
    "Legal",
    "Engineering",
    "Logistics",
    "Finance",
    "HSE",
    "Digital/IT"
  ]);

  type SanitizedSignal = {
    title: string;
    type: VpSignalType;
    horizon: VpHorizon;
    confidence: VpConfidence;
    impact: string;
    evidenceArticleIndex: number;
  };

  type SanitizedAction = {
    action: string;
    ownerRole: string;
    dueInDays: number;
    expectedImpact: string;
    confidence: VpConfidence;
    evidenceArticleIndex: number;
  };

  type SanitizedRisk = {
    risk: string;
    probability: VpConfidence;
    impact: VpConfidence;
    mitigation: string;
    trigger: string;
    horizon: VpHorizon;
    evidenceArticleIndex: number | undefined;
  };

  const sanitizeTopSignal = (item: unknown): SanitizedSignal | null => {
    if (!item || typeof item !== "object") return null;
    const typedItem = item as { [key: string]: unknown };
    const evidenceArticleIndex = validEvidenceIndex(typedItem.evidenceArticleIndex);
    if (evidenceArticleIndex === undefined) return null;
    return {
      title: typeof typedItem.title === "string" ? typedItem.title : "",
      type: sanitizeSignalType(typedItem.type) ?? "commercial",
      horizon: sanitizeHorizon(typedItem.horizon) ?? "30-180d",
      confidence: sanitizeConfidence(typedItem.confidence) ?? "medium",
      impact: typeof typedItem.impact === "string" ? typedItem.impact : "",
      evidenceArticleIndex
    };
  };

  const sanitizeRecommendedAction = (item: unknown): SanitizedAction | null => {
    if (!item || typeof item !== "object") return null;
    const typedItem = item as { [key: string]: unknown };
    const evidenceArticleIndex = validEvidenceIndex(typedItem.evidenceArticleIndex);
    if (evidenceArticleIndex === undefined) return null;
    const due = clamp(Number(typedItem.dueInDays) || 0, 1, 60);
    const ownerRole = typeof typedItem.ownerRole === "string" && allowedOwnerRoles.has(typedItem.ownerRole as string)
      ? (typedItem.ownerRole as string)
      : "Category Manager";

    return {
      action: typeof typedItem.action === "string" ? typedItem.action : "",
      ownerRole,
      dueInDays: Math.round(due),
      expectedImpact: typeof typedItem.expectedImpact === "string" ? typedItem.expectedImpact : "",
      confidence: sanitizeConfidence(typedItem.confidence) ?? "medium",
      evidenceArticleIndex
    };
  };

  const sanitizeRisk = (item: unknown): SanitizedRisk | null => {
    if (!item || typeof item !== "object") return null;
    const typedItem = item as { [key: string]: unknown };
    const evidenceArticleIndex = validEvidenceIndex(typedItem.evidenceArticleIndex);

    return {
      risk: typeof typedItem.risk === "string" ? typedItem.risk : "",
      probability: sanitizeConfidence(typedItem.probability) ?? "medium",
      impact: sanitizeConfidence(typedItem.impact) ?? "medium",
      mitigation: typeof typedItem.mitigation === "string" ? typedItem.mitigation : "",
      trigger: typeof typedItem.trigger === "string" ? typedItem.trigger : "",
      horizon: sanitizeHorizon(typedItem.horizon) ?? "30-180d",
      evidenceArticleIndex
    };
  };

  const topSignals = Array.isArray(raw.topSignals)
    ? (raw.topSignals as unknown[])
        .map(sanitizeTopSignal)
        .filter((item): item is SanitizedSignal => Boolean(item))
    : [];

  const recommendedActions = Array.isArray(raw.recommendedActions)
    ? (raw.recommendedActions as unknown[])
        .map(sanitizeRecommendedAction)
        .filter((item): item is SanitizedAction => Boolean(item))
    : [];

  const riskRegister = Array.isArray(raw.riskRegister)
    ? (raw.riskRegister as unknown[])
        .map(sanitizeRisk)
        .filter((item): item is SanitizedRisk => Boolean(item))
    : [];

  return {
    health,
    topSignals,
    recommendedActions,
    riskRegister
  };
}

/**
 * Builds the LLM prompt for Category Management brief generation.
 * 
 * This prompt positions the AI as a Category Management Intelligence Analyst,
 * writing daily briefs specifically tailored for category managers in O&G/LNG.
 * 
 * The briefs are:
 * - Fact-based and analytical (not journalistic)
 * - Category-specific with industry context
 * - Action-oriented for procurement decisions
 * - Concise and data-driven
 */
export function buildPrompt({
  agent,
  region,
  runWindow,
  articles,
  indices,
  repairIssues,
  previousJson,
  previousBrief
}: PromptInput): string {
  const regionLabel = region === "au" ? "Australia (Perth)" : "Americas (Houston)";
  const requiredCount = Math.min(requiredArticleCount(agent), Math.max(1, articles.length));

  // Format articles with index numbers for clear reference
  const articleList = articles
    .map((a, idx) => {
      const imageInfo = a.ogImageUrl ? `\nImage: ${a.ogImageUrl}` : "";
      const sourceInfo = a.sourceName ? ` (${a.sourceName})` : "";
      const dateInfo = a.publishedAt ? ` [${formatArticleDateForRegion(a.publishedAt, region)}]` : "";
      const contentNote =
        a.contentStatus === "thin"
          ? "\n**CONTENT_MISSING:** This article has limited or missing text. Do NOT use numbers from it."
          : "";
      return `
### Article ${idx + 1}${sourceInfo}${dateInfo}
**Title:** ${a.title}
**URL:** ${a.url}${imageInfo}
**EVIDENCE EXCERPTS (verbatim):**
${extractEvidenceExcerpts(a.content ?? "")}${contentNote}
`;
    })
    .join("\n---\n");

  // Format market indices
  const indexList = indices
    .map((idx) => `- ${idx.id}: ${idx.label} — ${idx.url}${idx.notes ? ` (${idx.notes})` : ""}`)
    .join("\n");

  const previousBriefSection = previousBrief
    ? `
## PREVIOUS BRIEF CONTEXT (for deltaSinceLastRun)

- Title: ${previousBrief.title}
- Published: ${formatDateForRegion(previousBrief.publishedAt, region)}
${previousBrief.highlights?.length ? `- Top Highlights:\n${previousBrief.highlights.map((h) => `  - ${h}`).join("\n")}` : ""}
${previousBrief.procurementActions?.length ? `- Procurement Actions:\n${previousBrief.procurementActions.map((a) => `  - ${a}`).join("\n")}` : ""}
${previousBrief.watchlist?.length ? `- Watchlist:\n${previousBrief.watchlist.map((w) => `  - ${w}`).join("\n")}` : ""}
${previousBrief.selectedArticles?.length ? `- Key Articles:\n${previousBrief.selectedArticles.map((a) => `  - ${a.title} (${a.url})`).join("\n")}` : ""}
`
    : `
## PREVIOUS BRIEF CONTEXT (for deltaSinceLastRun)

No previous brief exists for this portfolio/region. Set deltaSinceLastRun to an empty array [].
`;

  // Repair instructions if this is a retry
  const repairSection = repairIssues
    ? `
## ⚠️ REPAIR REQUIRED

Your previous output failed validation. Fix these issues:
${repairIssues.map((issue) => `- ${issue}`).join("\n")}

Previous JSON to fix:
\`\`\`json
${previousJson}
\`\`\`

**Rules for repair:**
- Use ONLY the articleIndex values listed in ARTICLES TO ANALYZE
- Do NOT invent new URLs or titles
- Ensure every selectedArticles entry references a valid articleIndex
`
    : "";

  // Build the full prompt with Category Manager context
  return `# Category Management Daily Intelligence Brief

${getCategoryManagerPersona(agent, region)}

---

## BRIEF GENERATION TASK

You are generating the **${runWindow.toUpperCase()}** edition of the daily intelligence brief for **${agent.label}** covering **${regionLabel}**.

${getCategoryBriefStructure()}

${getCategorySelectionGuidance(agent)}

${getWritingInstructions()}

${getCitationInstructions()}

${getImageInstructions()}

---

## EVIDENCE & FACT RULES
1. **Evidence tags are required for specific claims**:
   - **procurementActions** and **watchlist** items: MUST end with **"(source: articleIndex N)"** for any numeric claims, supplier names, or specific procurement actions.
   - **selectedArticles.briefContent** and **selectedArticles.categoryImportance**: Should use **"(source: articleIndex N)"** when referencing specific facts from that article.
   - **summary** and **highlights**: Can use **"(analysis)"** for general analysis and aggregated numbers. Evidence tags are preferred but not strictly required for general market commentary.
   - **deltaSinceLastRun**: Can use **"(analysis)"** for trend statements and comparisons.

2. **Numeric tokens**:
   - For **procurementActions** and **watchlist**: Numbers MUST have **"(source: articleIndex N)"** tags.
   - For **summary** and **highlights**: Numbers can be tagged as **(analysis)** if they represent general market trends or aggregated analysis.
   - If a statement is tagged "(analysis)", it can contain numeric tokens if they represent reasonable inference or aggregation.

3. **Do NOT use numbers from articles marked CONTENT_MISSING.**

4. **Key metrics rules**:
   - selectedArticles[].keyMetrics should be verbatim from evidence excerpts when possible.
   - Each keyMetric string should end with "(source: articleIndex N)" where N matches that articleIndex.
   - If exact numbers aren't available, use approximate values tagged as (analysis).

5. **Market snapshot numbers**:
   - Do NOT invent live price/benchmark numbers. The market snapshot tiles are added separately from trusted indices.

## OUTPUT FORMAT

Return ONLY valid JSON with this exact structure:

\`\`\`json
{
  "title": "Attention-grabbing headline for Category Managers (max ${WRITING_GUIDE.wordLimits.headline} words)",
  "summary": "Executive summary (each sentence must end with a source tag or (analysis))",
  "highlights": ["Top 3 market shifts (each bullet must end with a source tag or (analysis))", "..."],
  "procurementActions": ["Actionable step for category managers (must end with a source tag or (analysis))", "..."],
  "watchlist": ["Supplier/market item to monitor (must end with a source tag or (analysis))", "..."],
  "deltaSinceLastRun": ["What's changed vs. last run (must end with a source tag or (analysis))"],
  "decisionSummary": {
    "topMove": "1 sentence on the most important move today (end with a source tag or (analysis))",
    "whatChanged": ["1-3 bullets on what changed (end with a source tag or (analysis))"],
    "doNext": ["2-5 concrete actions (end with a source tag or (analysis))"],
    "watchThisWeek": ["2-4 triggers to monitor (end with a source tag or (analysis))"]
  },
  "selectedArticles": [
    {
      "articleIndex": 1,
      "briefContent": "Your ${WRITING_GUIDE.wordLimits.perArticleBrief}-word analyst brief covering: key facts, supplier impact, market context, and 1-2 expert insight sentences (analysis). Each sentence must end with a source tag or (analysis).",
      "categoryImportance": "1-2 sentence explanation of why this matters for category managers (each sentence must end with a source tag or (analysis))",
      "keyMetrics": ["$72/bbl WTI (source: articleIndex 1)", "+15% YoY (source: articleIndex 1)", "Q2 2025 timeline (source: articleIndex 1)"],
      "imageAlt": "Descriptive alt text for the image"
    }
  ],
  "heroSelection": { "articleIndex": 1 },
  "marketIndicators": [
    { "indexId": "cme-wti", "note": "1 sentence procurement context (e.g., 'WTI at $72 supports drilling activity, positive for rig demand')" },
    { "indexId": "ice-brent", "note": "1 sentence procurement context" }
  ],
  "cmSnapshot": {
    "todayPriorities": [
      {
        "title": "Priority to move this week",
        "why": "Why this matters now",
        "dueInDays": 7,
        "confidence": "low | medium | high",
        "evidenceArticleIndex": 1
      }
    ],
    "supplierRadar": [
      {
        "supplier": "Supplier name",
        "signal": "Observed signal",
        "implication": "What it means for the category",
        "nextStep": "Concrete next step for the CM",
        "confidence": "low | medium | high",
        "evidenceArticleIndex": 1
      }
    ],
    "negotiationLevers": [
      {
        "lever": "Negotiation tactic",
        "whenToUse": "Context to deploy",
        "expectedOutcome": "Expected buyer benefit",
        "confidence": "low | medium | high",
        "evidenceArticleIndex": 1
      }
    ],
    "intelGaps": ["Gap to close (optional)", "..."],
    "talkingPoints": ["Stakeholder one-liner (optional)"]
  },
  "vpSnapshot": {
    "health": {
      "overall": 85,
      "costPressure": 40,
      "supplyRisk": 60,
      "scheduleRisk": 30,
      "complianceRisk": 20,
      "narrative": "One sentence on the top exposure and why it matters"
    },
    "topSignals": [
      {
        "title": "One-line signal",
        "type": "cost | supply | schedule | regulatory | supplier | commercial",
        "horizon": "0-30d | 30-180d | 180d+",
        "confidence": "low | medium | high",
        "impact": "1 sentence describing cost/supply/schedule/compliance impact",
        "evidenceArticleIndex": 1
      }
    ],
    "recommendedActions": [
      {
        "action": "Imperative action",
        "ownerRole": "Category Manager | SRM | Contracts | Legal | Engineering | Logistics | Finance | HSE | Digital/IT",
        "dueInDays": 14,
        "expectedImpact": "1 sentence on what changes if we do this",
        "confidence": "low | medium | high",
        "evidenceArticleIndex": 1
      }
    ],
    "riskRegister": [
      {
        "risk": "Named risk",
        "probability": "low | medium | high",
        "impact": "low | medium | high",
        "mitigation": "Mitigation action",
        "trigger": "What to watch for",
        "horizon": "0-30d | 30-180d | 180d+",
        "evidenceArticleIndex": 1
      }
    ]
  }
}
\`\`\`

Rules for cmSnapshot output:
- todayPriorities, supplierRadar, and negotiationLevers should each include 3-6 items when available.
- dueInDays must be between 1 and 30.
- evidenceArticleIndex must reference one of the selectedArticles.articleIndex values.
- confidence must be "low", "medium", or "high".
- Do NOT include any URLs; evidenceArticleIndex links back to the selectedArticles list.

## CRITICAL REQUIREMENTS

1. **CATEGORY MANAGER FOCUS**: Every insight must connect to sourcing implications for ${agent.label}
2. **NO URL OUTPUT**: Do NOT output any URLs. Only reference articles by \`articleIndex\`
3. **SELECT 1–${requiredCount} ARTICLES**: Choose up to ${requiredCount} UNIQUE articleIndex values from 1..${articles.length}. Prefer 2 if relevant; never add filler.
4. **HERO MUST BE SELECTED**: heroSelection.articleIndex must match one of the selectedArticles entries
5. **MARKET INDICATORS BY ID**: For marketIndicators, pick by indexId from the list below (no URLs in JSON)
6. **ANALYST TONE**: Write like a procurement analyst, not a journalist. Facts and implications, no filler.
7. **CATEGORY IMPORTANCE REQUIRED**: Each article MUST include a categoryImportance field explaining why this matters for category managers
8. **KEY METRICS**: Include up to 2-4 evidence-backed metrics per article when available; if no numeric data exists, omit keyMetrics or use non-numeric metrics tagged as (analysis) without numbers
9. **ACTIONABLE OUTPUTS**: Populate highlights, procurementActions, watchlist, and deltaSinceLastRun (max 3 bullets) with concise, unique bullets
10. **DELTA TRACEABILITY**: If there is no previous brief, deltaSinceLastRun must be []. If a previous brief is provided, deltas must reference concrete changes vs that brief (new suppliers, new price moves, new events). No generic filler.
11. **VP SNAPSHOT DATA ONLY**: vpSnapshot.health.* must be integers 0..100. topSignals/recommendedActions/riskRegister should have 3-5 items each when possible (never empty unless no signal). evidenceArticleIndex must match one of the selectedArticles.articleIndex values. ownerRole must be one of: Category Manager, SRM, Contracts, Legal, Engineering, Logistics, Finance, HSE, Digital/IT. dueInDays must be 1..60. Do NOT include any URLs anywhere in vpSnapshot.
12. **CM SNAPSHOT ACTIONABILITY**: cmSnapshot.todayPriorities, supplierRadar, and negotiationLevers should each target 3-6 items when possible. dueInDays must be 1..30. confidence must be low|medium|high. evidenceArticleIndex MUST match a selectedArticles.articleIndex value. No URLs in cmSnapshot. Every item must include a concrete next step that a category manager can execute without internal systems; prefer naming key suppliers from the agent context where relevant.
13. **DEPTH REQUIREMENT**: Use the extensive evidence excerpts provided. Reference specific details, numbers, suppliers, contracts, and market conditions from the articles. Avoid generic summaries. Provide category management insights that demonstrate deep understanding of the news and its procurement implications.
14. **EVIDENCE UTILIZATION**: The evidence excerpts contain rich detail. Use them fully. Extract specific facts, not just general themes. Reference actual company names, contract values, dates, locations, and market data when present in the evidence.
15. **DECISION BRIEF FIRST**: decisionSummary, cmSnapshot, and vpSnapshot must be the primary decision artifact. Prioritize concrete actions, supplier implications, negotiation levers, and risks before narrative.
16. **NO FLUFF**: Avoid phrases like "may impact" or "could affect" unless immediately followed by "because ..." with a concrete mechanism. Replace hedging with precise cause/effect.
17. **NEGOTIATION LEVERS**: Each cmSnapshot.negotiationLevers item must mention the commercial mechanism (indexation, caps/collars, extension option, dual sourcing, minimum volume, standby retainer, LDs, substitution clauses, etc).
18. **SUPPLIER RADAR NEXT STEPS**: Each cmSnapshot.supplierRadar.nextStep must be a tangible action the CM can take without internal systems (email ask, RFQ refresh, schedule supplier call, clause review, etc).

## MARKET INDICES

For the Market Indicators section, reference these (select by indexId only):
${indexList}

${previousBriefSection}

## ARTICLES TO ANALYZE

Select 1 to ${requiredCount} most relevant articles for ${agent.label} category managers (select fewer if only 1-2 articles are truly relevant):

${articleList}

${repairSection}

## EVIDENCE USAGE INSTRUCTIONS

**CRITICAL**: The EVIDENCE EXCERPTS above contain extensive detail from each article. You MUST:
1. **Use specific facts** from the evidence excerpts - reference actual numbers, company names, contract details, dates, and locations
2. **Avoid generic summaries** - if the evidence mentions "Baker Hughes secured a $50M contract", say exactly that, not "a major contract was awarded"
3. **Extract procurement insights** - identify supplier names, contract values, pricing trends, capacity changes, and market shifts
4. **Connect to category management** - explain how each specific fact impacts sourcing, negotiations, risk, or budget planning
5. **Reference evidence directly** - when you mention a number or fact, it should be traceable to the evidence excerpts provided

The evidence excerpts are your primary source material. Use them fully to create deep, actionable intelligence briefs.

## FINAL CHECKLIST

Before submitting, verify:
- [ ] Headline leads with impact (use numbers only if supported by evidence)
- [ ] Summary explains "so what" for category managers with specific details
- [ ] Each article brief connects news to sourcing implications using specific facts from evidence
- [ ] Market indicators include procurement context
- [ ] No filler phrases or generic statements
- [ ] 1 to ${requiredCount} unique articles selected (quality over quantity)
- [ ] JSON is valid and complete
- [ ] Evidence excerpts have been fully utilized - briefs reference specific details, not just general themes
`;
}

/**
 * Validates and extracts the structured output from LLM response
 */
export function parsePromptOutput(raw: string, requiredCount: number): BriefOutput {
  // Extract JSON from the response (handle markdown code blocks)
  let jsonStr = raw;
  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }
  
  const parsed = JSON.parse(jsonStr);

  const selected = Array.isArray(parsed.selectedArticles) ? parsed.selectedArticles : [];
  const heroIndex = parsed?.heroSelection?.articleIndex;
  const marketIndicators = Array.isArray(parsed.marketIndicators) ? parsed.marketIndicators : [];
  const highlights = sanitizeStringArray(parsed.highlights, 5);
  const procurementActions = sanitizeStringArray(parsed.procurementActions, 5);
  const watchlist = sanitizeStringArray(parsed.watchlist, 5);
  const deltaSinceLastRun = sanitizeStringArray(parsed.deltaSinceLastRun, 3);
  const decisionSummary = sanitizeDecisionSummary(parsed.decisionSummary);

  const issues: string[] = [];
  const indices = new Set<number>();

  for (const article of selected) {
    const idx = Number(article.articleIndex);
    if (!Number.isInteger(idx) || idx < 1) {
      issues.push("Each selectedArticles entry must have a positive integer articleIndex");
      continue;
    }
    indices.add(idx);
  }

  if (selected.length < 1) {
    issues.push(`Must return at least 1 selectedArticles entry`);
  }
  if (selected.length > requiredCount) {
    issues.push(`Must return at most ${requiredCount} selectedArticles entries`);
  }

  if (indices.size !== selected.length) {
    issues.push("selectedArticles must have unique articleIndex values");
  }

  if (!indices.has(heroIndex)) {
    issues.push("heroSelection.articleIndex must reference a selected article");
  }

  const vpSnapshot = sanitizeVpSnapshot(parsed.vpSnapshot, indices);
  const cmSnapshot = sanitizeCmSnapshot(parsed.cmSnapshot, indices);

  if (issues.length > 0) {
    throw new Error(JSON.stringify(issues));
  }

  return {
    title: parsed.title || "Untitled Brief",
    summary: parsed.summary || "",
    highlights,
    procurementActions,
    watchlist,
    deltaSinceLastRun,
    decisionSummary,
    selectedArticles: selected.map((article: any) => ({
      articleIndex: Number(article.articleIndex),
      briefContent: article.briefContent || "",
      categoryImportance: article.categoryImportance || "",
      keyMetrics: Array.isArray(article.keyMetrics) ? article.keyMetrics : [],
      imageAlt: article.imageAlt
    })),
    heroSelection: { articleIndex: Number(heroIndex) },
    marketIndicators: marketIndicators.map((m: any) => ({ indexId: m.indexId, note: (m.note || "").toString() })),
    vpSnapshot,
    cmSnapshot
  };
}
