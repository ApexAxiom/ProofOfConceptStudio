import { AgentConfig, RegionSlug, RunWindow } from "@proof/shared";

export interface PromptInput {
  agent: AgentConfig;
  region: RegionSlug;
  runWindow: RunWindow;
  articles: { title: string; url: string; content?: string }[];
}

export function buildPrompt({ agent, region, runWindow, articles }: PromptInput) {
  const articleList = articles
    .map((a, idx) => `${idx + 1}. ${a.title}\nURL: ${a.url}\n${a.content?.slice(0, 500) ?? ""}`)
    .join("\n\n");

  return `You are a procurement intelligence analyst generating a brief for portfolio ${agent.label} in region ${region} for the ${runWindow.toUpperCase()} run.\nUse only the provided articles. Every bullet MUST end with a URL in parentheses. Do not invent links. Return JSON with fields: title, summary, sources (array of URLs), bodyMarkdown. bodyMarkdown must follow this markdown template strictly:\n\n# {Title}\n**Region:** {Region Label}  \n**Portfolio:** {Portfolio Label}  \n**Run:** {AM|PM}  \n**Published:** {ISO timestamp}\n\n## 3 Takeaways\n- ... (URL)\n- ... (URL)\n- ... (URL)\n\n## Market Snapshot\n- index label: short note (URL)\n- ...\n\n## Developments\n- ... (URL)\n- ... (URL)\n- ...\n\n## Procurement Impact\n- ... (URL)\n- ...\n\n## Recommended Actions\n- ... (URL)\n- ...\n\n## Sources\n- URL\n- URL\n\nArticles:\n${articleList}`;
}
