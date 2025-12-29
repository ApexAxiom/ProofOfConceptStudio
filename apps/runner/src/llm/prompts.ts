import { AgentConfig, MarketIndex, RegionSlug, RunWindow } from "@proof/shared";
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
}

/**
 * Expected JSON output structure from the LLM
 */
export interface BriefOutput {
  title: string;
  summary: string;
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
export function buildPrompt({ agent, region, runWindow, articles, indices, repairIssues, previousJson }: PromptInput): string {
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
  ]
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

## MARKET INDICES

For the Market Indicators section, reference these (select by indexId only):
${indexList}

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

  if (issues.length > 0) {
    throw new Error(JSON.stringify(issues));
  }

  return {
    title: parsed.title || "Untitled Brief",
    summary: parsed.summary || "",
    selectedArticles: selected.map((article: any) => ({
      articleIndex: Number(article.articleIndex),
      briefContent: article.briefContent || "",
      categoryImportance: article.categoryImportance || "",
      keyMetrics: Array.isArray(article.keyMetrics) ? article.keyMetrics : [],
      imageAlt: article.imageAlt
    })),
    heroSelection: { articleIndex: Number(heroIndex) },
    marketIndicators: marketIndicators.map((m: any) => ({ indexId: m.indexId, note: m.note || "" }))
  };
}
