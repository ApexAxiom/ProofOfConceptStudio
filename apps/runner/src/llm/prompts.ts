import { AgentConfig, MarketIndex, RegionSlug, RunWindow, SelectedArticle } from "@proof/shared";
import { getWritingInstructions, getCitationInstructions, getImageInstructions, WRITING_GUIDE } from "./writing-guide.js";

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
  bodyMarkdown: string;
  selectedArticles: Array<{
    title: string;
    url: string;
    briefContent: string;
    imageUrl?: string;
    imageAlt?: string;
    sourceName?: string;
  }>;
  heroArticleIndex: number;
  sources: string[];
}

/**
 * Builds the LLM prompt for brief generation with strict article linking requirements.
 * Uses the centralized writing guide for consistent output across all categories.
 */
export function buildPrompt({ agent, region, runWindow, articles, indices, repairIssues, previousJson }: PromptInput): string {
  const regionLabel = region === "au" ? "Australia (Perth)" : "Americas (Houston)";
  const timestamp = new Date().toISOString();
  
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
    .map((idx) => `- ${idx.label}: ${idx.url}${idx.notes ? ` (${idx.notes})` : ""}`)
    .join("\n");

  // Build the allowed URLs list for validation
  const allowedUrls = articles.map((a) => a.url);

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
- Use ONLY the URLs listed in ALLOWED ARTICLE URLs
- Do NOT invent new URLs
- Ensure every selectedArticle has an exact URL from the list
`
    : "";

  return `# Brief Generation Task

You are generating a news brief for **${agent.label}** in **${regionLabel}** for the **${runWindow.toUpperCase()}** edition.

## YOUR MISSION

1. Select the **${WRITING_GUIDE.articleSelection.count} most newsworthy articles** from the provided list
2. Write a brief summary for each selected article
3. Create an overall headline and summary
4. Ensure every article is linked with its EXACT original URL

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
      "title": "Original article title",
      "url": "EXACT URL from the article list - DO NOT MODIFY",
      "briefContent": "Your ${WRITING_GUIDE.wordLimits.perArticleBrief}-word brief of this article",
      "imageUrl": "Image URL from this article (if available)",
      "imageAlt": "Descriptive alt text for the image",
      "sourceName": "Publication name"
    }
  ],
  "heroArticleIndex": 0,
  "bodyMarkdown": "Full markdown body (see template below)",
  "sources": ["array of all cited URLs"]
}
\`\`\`

## MARKDOWN BODY TEMPLATE

\`\`\`markdown
# {Your Headline}

**Region:** ${regionLabel}  
**Portfolio:** ${agent.label}  
**Edition:** ${runWindow.toUpperCase()}  
**Published:** ${timestamp}

## 📌 Executive Summary

{Your 1-2 sentence summary with the key insight. Include specific numbers.}

---

## 📰 Top Stories

### 1. {Article 1 Title}

{Your ${WRITING_GUIDE.wordLimits.perArticleBrief}-word brief of article 1. Focus on what matters for category managers. Include specific numbers, dates, and impacts.}

**Source:** [{Article 1 Title}]({EXACT Article 1 URL})

---

### 2. {Article 2 Title}

{Your ${WRITING_GUIDE.wordLimits.perArticleBrief}-word brief of article 2.}

**Source:** [{Article 2 Title}]({EXACT Article 2 URL})

---

### 3. {Article 3 Title}

{Your ${WRITING_GUIDE.wordLimits.perArticleBrief}-word brief of article 3.}

**Source:** [{Article 3 Title}]({EXACT Article 3 URL})

---

## 📊 Market Indicators

{Reference 2-3 relevant market indices from the list below}

- **{Index Name}**: Current context/trend ([Source]({Index URL}))

---

## 📎 All Sources

- [{Article 1 Title}]({Article 1 URL})
- [{Article 2 Title}]({Article 2 URL})
- [{Article 3 Title}]({Article 3 URL})
\`\`\`

## CRITICAL REQUIREMENTS

1. **EXACT URLs ONLY**: Use the URLs exactly as provided. Do NOT modify, shorten, or create URLs.
2. **SELECT 3 ARTICLES**: Choose exactly 3 articles from the list below.
3. **LINK EVERY ARTICLE**: Each article brief MUST end with its exact source link.
4. **NO DUPLICATION**: Do not repeat the same information in multiple sections.
5. **NO FILLER**: Every sentence must add value. Cut anything that doesn't.

## ALLOWED ARTICLE URLs

You may ONLY use these URLs in your output:
${allowedUrls.map((url) => `- ${url}`).join("\n")}

## MARKET INDICES

For the Market Indicators section, reference these:
${indexList}

## ARTICLES TO ANALYZE

Select the 3 most newsworthy articles from:

${articleList}

${repairSection}

## FINAL REMINDER

- Use EXACT URLs from the allowed list
- Every article brief ends with its source link
- No filler phrases or duplication
- Lead with impact and numbers
- Write for busy executives
`;
}

/**
 * Validates and extracts the structured output from LLM response
 */
export function parsePromptOutput(raw: string): BriefOutput {
  const parsed = JSON.parse(raw);
  
  return {
    title: parsed.title || "Untitled Brief",
    summary: parsed.summary || "",
    bodyMarkdown: parsed.bodyMarkdown || "",
    selectedArticles: (parsed.selectedArticles || []).map((article: any) => ({
      title: article.title || "",
      url: article.url || "",
      briefContent: article.briefContent || "",
      imageUrl: article.imageUrl,
      imageAlt: article.imageAlt,
      sourceName: article.sourceName
    })),
    heroArticleIndex: parsed.heroArticleIndex ?? 0,
    sources: parsed.sources || []
  };
}
