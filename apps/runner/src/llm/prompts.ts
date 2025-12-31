import {
  AgentConfig,
  MarketIndex,
  RegionSlug,
  RunWindow,
  VpSnapshot,
  VpConfidence,
  VpHorizon,
  VpSignalType
} from "@proof/shared";
import { getWritingInstructions, getCitationInstructions, getImageInstructions, WRITING_GUIDE } from "./writing-guide.js";
import { getCategoryManagerPersona, getCategorySelectionGuidance, getCategoryBriefStructure } from "./category-manager-prompt.js";

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function requiredArticleCount(agent: AgentConfig): number {
  return clamp(agent.articlesPerRun ?? WRITING_GUIDE.articleSelection.count, 1, 5);
}

export interface ArticleInput {
  title: string;
  url: string;
  content?: string;
  ogImageUrl?: string;
  sourceName?: string;
  publishedAt?: string;
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
}

function sanitizeStringArray(value: unknown, maxItems = 10): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0)
    .slice(0, maxItems);
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

  const topSignals = Array.isArray(raw.topSignals)
    ? raw.topSignals
        .map((item: any) => {
          const evidenceArticleIndex = validEvidenceIndex(item?.evidenceArticleIndex);
          if (evidenceArticleIndex === undefined) return null;
          return {
            title: typeof item?.title === "string" ? item.title : "",
            type: sanitizeSignalType(item?.type) ?? "commercial",
            horizon: sanitizeHorizon(item?.horizon) ?? "30-180d",
            confidence: sanitizeConfidence(item?.confidence) ?? "medium",
            impact: typeof item?.impact === "string" ? item.impact : "",
            evidenceArticleIndex
          };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
    : [];

  const recommendedActions = Array.isArray(raw.recommendedActions)
    ? raw.recommendedActions
        .map((item: any) => {
          const evidenceArticleIndex = validEvidenceIndex(item?.evidenceArticleIndex);
          if (evidenceArticleIndex === undefined) return null;
          const due = clamp(Number(item?.dueInDays) || 0, 1, 60);
          const ownerRole = typeof item?.ownerRole === "string" && allowedOwnerRoles.has(item.ownerRole)
            ? item.ownerRole
            : "Category Manager";
          return {
            action: typeof item?.action === "string" ? item.action : "",
            ownerRole,
            dueInDays: Math.round(due),
            expectedImpact: typeof item?.expectedImpact === "string" ? item.expectedImpact : "",
            confidence: sanitizeConfidence(item?.confidence) ?? "medium",
            evidenceArticleIndex
          };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
    : [];

  const riskRegister = Array.isArray(raw.riskRegister)
    ? raw.riskRegister
        .map((item: any) => {
          const evidenceArticleIndex = validEvidenceIndex(item?.evidenceArticleIndex);
          return {
            risk: typeof item?.risk === "string" ? item.risk : "",
            probability: sanitizeConfidence(item?.probability) ?? "medium",
            impact: sanitizeConfidence(item?.impact) ?? "medium",
            mitigation: typeof item?.mitigation === "string" ? item.mitigation : "",
            trigger: typeof item?.trigger === "string" ? item.trigger : "",
            horizon: sanitizeHorizon(item?.horizon) ?? "30-180d",
            evidenceArticleIndex
          };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
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
      const dateInfo = a.publishedAt ? ` [${new Date(a.publishedAt).toLocaleDateString()}]` : "";
      return `
### Article ${idx + 1}${sourceInfo}${dateInfo}
**Title:** ${a.title}
**URL:** ${a.url}${imageInfo}
**Content Preview:**
${a.content?.slice(0, 1500) ?? "[No content available]"}
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
- Published: ${new Date(previousBrief.publishedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
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

## OUTPUT FORMAT

Return ONLY valid JSON with this exact structure:

\`\`\`json
{
  "title": "Attention-grabbing headline for Category Managers (max ${WRITING_GUIDE.wordLimits.headline} words)",
  "summary": "Executive summary with key insight and procurement implications (max ${WRITING_GUIDE.wordLimits.summary} words)",
  "highlights": ["Top 3 market shifts (1 sentence each)", "..."],
  "procurementActions": ["Actionable step for category managers", "..."],
  "watchlist": ["Supplier/market item to monitor", "..."],
  "deltaSinceLastRun": ["What's changed vs. last run"],
  "selectedArticles": [
    {
      "articleIndex": 1,
      "briefContent": "Your ${WRITING_GUIDE.wordLimits.perArticleBrief}-word analyst brief covering: key facts, supplier impact, and market context",
      "categoryImportance": "1-2 sentence explanation of why this matters for category managers. Focus on actionable insight: 'This signals X for your supplier negotiations' or 'Monitor this because Y affects your contracts'",
      "keyMetrics": ["$72/bbl WTI", "+15% YoY", "Q2 2025 timeline"],
      "imageAlt": "Descriptive alt text for the image"
    }
  ],
  "heroSelection": { "articleIndex": 1 },
  "marketIndicators": [
    { "indexId": "cme-wti", "note": "1 sentence procurement context (e.g., 'WTI at $72 supports drilling activity, positive for rig demand')" },
    { "indexId": "ice-brent", "note": "1 sentence procurement context" }
  ],
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

## CRITICAL REQUIREMENTS

1. **CATEGORY MANAGER FOCUS**: Every insight must connect to sourcing implications for ${agent.label}
2. **NO URL OUTPUT**: Do NOT output any URLs. Only reference articles by \`articleIndex\`
3. **SELECT ${requiredCount} ARTICLES**: Choose exactly ${requiredCount} UNIQUE articleIndex values from 1..${articles.length}
4. **HERO MUST BE SELECTED**: heroSelection.articleIndex must match one of the selectedArticles entries
5. **MARKET INDICATORS BY ID**: For marketIndicators, pick by indexId from the list below (no URLs in JSON)
6. **ANALYST TONE**: Write like a procurement analyst, not a journalist. Facts and implications, no filler.
7. **CATEGORY IMPORTANCE REQUIRED**: Each article MUST include a categoryImportance field explaining why this matters for category managers
8. **KEY METRICS**: Extract 2-4 key numbers, percentages, dates, or values from each article
9. **ACTIONABLE OUTPUTS**: Populate highlights, procurementActions, watchlist, and deltaSinceLastRun (max 3 bullets) with concise, unique bullets
10. **DELTA TRACEABILITY**: If there is no previous brief, deltaSinceLastRun must be []. If a previous brief is provided, deltas must reference concrete changes vs that brief (new suppliers, new price moves, new events). No generic filler.
11. **VP SNAPSHOT DATA ONLY**: vpSnapshot.health.* must be integers 0..100. topSignals/recommendedActions/riskRegister should have 3-5 items each when possible (never empty unless no signal). evidenceArticleIndex must match one of the selectedArticles.articleIndex values. ownerRole must be one of: Category Manager, SRM, Contracts, Legal, Engineering, Logistics, Finance, HSE, Digital/IT. dueInDays must be 1..60. Do NOT include any URLs anywhere in vpSnapshot.

## MARKET INDICES

For the Market Indicators section, reference these (select by indexId only):
${indexList}

${previousBriefSection}

## ARTICLES TO ANALYZE

Select the ${requiredCount} most relevant articles for ${agent.label} category managers:

${articleList}

${repairSection}

## FINAL CHECKLIST

Before submitting, verify:
- [ ] Headline leads with impact and includes a number
- [ ] Summary explains "so what" for category managers
- [ ] Each article brief connects news to sourcing implications
- [ ] Market indicators include procurement context
- [ ] No filler phrases or generic statements
- [ ] Exactly ${requiredCount} unique articles selected
- [ ] JSON is valid and complete
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

  if (selected.length !== requiredCount) {
    issues.push(`Must return exactly ${requiredCount} selectedArticles entries`);
  }

  if (indices.size !== selected.length) {
    issues.push("selectedArticles must have unique articleIndex values");
  }

  if (!indices.has(heroIndex)) {
    issues.push("heroSelection.articleIndex must reference a selected article");
  }

  const vpSnapshot = sanitizeVpSnapshot(parsed.vpSnapshot, indices);

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
    selectedArticles: selected.map((article: any) => ({
      articleIndex: Number(article.articleIndex),
      briefContent: article.briefContent || "",
      categoryImportance: article.categoryImportance || "",
      keyMetrics: Array.isArray(article.keyMetrics) ? article.keyMetrics : [],
      imageAlt: article.imageAlt
    })),
    heroSelection: { articleIndex: Number(heroIndex) },
    marketIndicators: marketIndicators.map((m: any) => ({ indexId: m.indexId, note: (m.note || "").toString() })),
    vpSnapshot
  };
}
