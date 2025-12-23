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
 */
export function buildPrompt({ agent, region, runWindow, articles, indices, repairIssues, previousJson }: PromptInput) {
  const articleList = articles
    .map((a, idx) => `${idx + 1}. ${a.title}\nURL: ${a.url}\n${a.content?.slice(0, 800) ?? ""}`)
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

  return `You are a procurement intelligence analyst generating a brief for portfolio ${agent.label} in region ${region} for the ${runWindow.toUpperCase()} run.
Use only the provided articles and allowed index URLs. Every bullet MUST end with an allowed URL in parentheses. Do not invent links. Return JSON with fields: title, summary, sources (array of URLs), bodyMarkdown. bodyMarkdown must follow this markdown template strictly:

# {Title}
**Region:** {Region Label}  
**Portfolio:** {Portfolio Label}  
**Run:** {AM|PM}  
**Published:** {ISO timestamp}

## 3 Takeaways
- ... (URL)
- ... (URL)
- ... (URL)

## Market Snapshot
- index label: short note (URL)
- ...

## Developments
- ... (URL)
- ... (URL)
- ...

## Procurement Impact
- ... (URL)
- ...

## Recommended Actions
- ... (URL)
- ...

## Sources
- URL
- URL

Market indices you are allowed to cite for Market Snapshot (use these URLs only):
${indexList}

Allowed article URLs:
${articles.map((a) => `- ${a.url}`).join("\n")}

Articles:
${articleList}${previous}${repairSuffix}`;
}
