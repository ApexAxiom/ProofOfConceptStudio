import { AgentConfig, MarketIndex, RegionSlug, RunWindow } from "@proof/shared";

export interface PromptInput {
  agent: AgentConfig;
  region: RegionSlug;
  runWindow: RunWindow;
  articles: { title: string; url: string; content?: string }[];
  indices: MarketIndex[];
  repairIssues?: string[];
  previousJson?: string;
}

/**
 * Builds the LLM prompt for brief generation with strict citation requirements.
 * Optimized for attention-grabbing, executive-ready summaries.
 */
export function buildPrompt({ agent, region, runWindow, articles, indices, repairIssues, previousJson }: PromptInput) {
  const articleList = articles
    .map((a, idx) => `${idx + 1}. ${a.title}\nURL: ${a.url}\n${a.content?.slice(0, 1000) ?? ""}`)
    .join("\n\n");

  const indexList = indices
    .map((idx) => `- ${idx.label} (${idx.url})${idx.notes ? ` — ${idx.notes}` : ""}`)
    .join("\n");

  const repairSuffix = repairIssues
    ? `\nThe previous draft failed validation for these issues: ${repairIssues.join(
        "; "
      )}. Provide corrected JSON only. Do not invent new URLs.`
    : "";

  const previous = previousJson ? `\nPrevious JSON (fix it): ${previousJson}` : "";

  const regionLabel = region === "au" ? "Australia (Perth)" : "Americas (Houston)";

  return `You are a SENIOR PROCUREMENT INTELLIGENCE ANALYST writing an executive brief for category managers in the energy and resources sector.

YOUR MISSION: Create a punchy, insight-rich brief for the "${agent.label}" portfolio in ${regionLabel} for the ${runWindow.toUpperCase()} edition.

WRITING STYLE REQUIREMENTS:
- Write like Bloomberg or Reuters — crisp, authoritative, no fluff
- Lead with the MOST IMPORTANT news that affects procurement decisions
- Use active voice and power verbs: "surged", "plunged", "signals", "threatens"
- Include specific numbers, percentages, and dollar figures when available
- Make category managers feel informed and ahead of the curve
- Every sentence must add value — cut anything that doesn't

HEADLINE RULES:
- Start with action or impact, not "Weekly Update" or boring labels
- Example good: "LNG Spot Prices Surge 12% as Asian Demand Rebounds"
- Example good: "Subsea Contractors Face Capacity Crunch Through 2026"
- Example bad: "Update on Drilling Services Market"

SUMMARY RULES (1-2 sentences max):
- Open with the single most actionable insight
- Include a specific data point or trend if available
- End with "what this means" for category managers

CITATION RULES (CRITICAL):
- Every claim MUST end with source URL in parentheses
- Only use URLs from the provided article list or market indices
- Do NOT invent, modify, or hallucinate any URLs
- If you can't cite it, don't write it

Return valid JSON with these fields:
{
  "title": "Attention-grabbing headline with impact",
  "summary": "1-2 sentence executive summary with key insight",
  "bodyMarkdown": "Full markdown body following template below",
  "sources": ["array", "of", "all", "cited", "URLs"]
}

MARKDOWN TEMPLATE (follow exactly):

# {Compelling Title}

**Region:** ${regionLabel}  
**Portfolio:** ${agent.label}  
**Edition:** ${runWindow.toUpperCase()}  
**Published:** {ISO timestamp}

## 📌 The Bottom Line

{2-3 sentences capturing THE key insight and why it matters for category managers. Include specific numbers. End with citation (URL)}

## ⚡ Quick Takes

- **{Bold insight}** — {Supporting detail with specific data point} ([Source](URL))
- **{Bold insight}** — {Supporting detail} ([Source](URL))
- **{Bold insight}** — {Supporting detail} ([Source](URL))

## 🔍 What to Watch

- {Trend or development category managers should monitor} ([Source](URL))
- {Risk or opportunity on the horizon} ([Source](URL))

## 📊 Market Pulse

{Use ONLY the market indices listed below - cite the exact URL provided}
- **{Index Name}**: {Brief current status or recent movement} ([Index URL])
- **{Index Name}**: {Brief current status or recent movement} ([Index URL])

## 📎 Sources

- [Source Title](URL)
- [Source Title](URL)

---

MARKET INDICES (use these exact URLs for Market Pulse section):
${indexList}

ALLOWED ARTICLE URLs (cite only these):
${articles.map((a) => `- ${a.url}`).join("\n")}

ARTICLES TO ANALYZE:
${articleList}${previous}${repairSuffix}

REMEMBER: Write for busy executives. Lead with impact. Cite everything. No fluff.`;
}
