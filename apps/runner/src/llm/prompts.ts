import { AgentConfig, MarketIndex, RegionSlug, RunWindow } from "@proof/shared";
import { getWritingInstructions, getCitationInstructions, getImageInstructions, WRITING_GUIDE } from "./writing-guide.js";

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
    imageAlt?: string;
  }>;
  heroSelection: { articleIndex: number };
  marketIndicators: Array<{ indexId: string; note: string }>;
}

/**
 * Builds the LLM prompt for brief generation with strict article linking requirements.
 * Uses the centralized writing guide for consistent output across all categories.
 */
export function buildPrompt({ agent, region, runWindow, articles, indices, repairIssues, previousJson }: PromptInput): string {
  const regionLabel = region === "au" ? "Australia (Perth)" : "Americas (Houston)";
  const requiredCount = Math.min(requiredArticleCount(agent), Math.max(1, articles.length));

  // Format articles with index numbers for clear reference
  const articleList = articles
    .map((a, idx) => {
      const imageInfo = a.ogImageUrl ? `\nImage: ${a.ogImageUrl}` : "";
      const sourceInfo = a.sourceName ? ` (${a.sourceName})` : "";
      return `
### Article ${idx + 1}${sourceInfo}
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

  return `# Brief Generation Task

You are generating a news brief for **${agent.label}** in **${regionLabel}** for the **${runWindow.toUpperCase()}** edition.

## YOUR MISSION

1. Select the **${requiredCount} most newsworthy articles** from the provided list
2. Write a brief summary for each selected article
3. Create an overall headline and summary
4. Do NOT output URLs; only reference articles by their index numbers

${getWritingInstructions()}

${getCitationInstructions()}

${getImageInstructions()}

## OUTPUT FORMAT

Return ONLY valid JSON with this exact structure:

\`\`\`json
{
  "title": "Attention-grabbing headline (max ${WRITING_GUIDE.wordLimits.headline} words)",
  "summary": "1-2 sentence executive summary with key insight (max ${WRITING_GUIDE.wordLimits.summary} words)",
  "selectedArticles": [
    {
      "articleIndex": 1,
      "briefContent": "Your ${WRITING_GUIDE.wordLimits.perArticleBrief}-word brief of this article",
      "imageAlt": "Descriptive alt text for the image"
    }
  ],
  "heroSelection": { "articleIndex": 1 },
  "marketIndicators": [
    { "indexId": "cme-wti", "note": "1 sentence context" },
    { "indexId": "ice-brent", "note": "1 sentence context" }
  ]
}
\`\`\`

## CRITICAL REQUIREMENTS

1. **NO URL OUTPUT**: Do NOT output any URLs. Only reference articles by `articleIndex`.
2. **SELECT ${requiredCount} ARTICLES**: Choose exactly ${requiredCount} UNIQUE articleIndex values from 1..${articles.length}.
3. **HERO MUST BE SELECTED**: heroSelection.articleIndex must match one of the selectedArticles entries.
4. **MARKET INDICATORS BY ID**: For marketIndicators, pick by indexId from the list below (no URLs in JSON).
5. **NO FILLER**: Every sentence must add value. Cut anything that doesn't.

## MARKET INDICES

For the Market Indicators section, reference these (select by indexId only):
${indexList}

## ARTICLES TO ANALYZE

Select the ${requiredCount} most newsworthy unique articles from:

${articleList}

${repairSection}

## FINAL REMINDER

- Do NOT output URLs; only use articleIndex values
- Keep selections unique and aligned to the provided list
- No filler phrases or duplication
- Lead with impact and numbers
- Write for busy executives
`;
}

/**
 * Validates and extracts the structured output from LLM response
 */
export function parsePromptOutput(raw: string, requiredCount: number): BriefOutput {
  const parsed = JSON.parse(raw);

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
      imageAlt: article.imageAlt
    })),
    heroSelection: { articleIndex: Number(heroIndex) },
    marketIndicators: marketIndicators.map((m: any) => ({ indexId: m.indexId, note: m.note || "" }))
  };
}
