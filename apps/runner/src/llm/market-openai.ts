import crypto from "node:crypto";
import { BriefMarketIndicator, BriefPost, SelectedArticle } from "@proof/shared";
import { OpenAI } from "openai";
import { renderBriefMarkdown } from "./render.js";
import { selectHeroArticle } from "./hero-selection.js";
import { MarketPromptInput, MarketOutput, buildMarketPrompt, parseMarketOutput } from "./market-prompts.js";

const DEFAULT_MODEL = "gpt-4o";
let cachedKey: string | null = null;
let cachedClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  if (cachedClient && cachedKey === apiKey) return cachedClient;
  cachedKey = apiKey;
  cachedClient = new OpenAI({ apiKey });
  return cachedClient;
}

function getModel() {
  return process.env.OPENAI_MODEL || DEFAULT_MODEL;
}

export async function generateMarketBrief(input: MarketPromptInput): Promise<BriefPost> {
  const client = getOpenAIClient();
  if (!client) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  // Allow the dashboard to include broader cross-category coverage when configured.
  const requiredCount = Math.min(input.agent.articlesPerRun ?? 3, Math.max(1, Math.min(8, input.candidates.length)));
  const prompt = buildMarketPrompt({ ...input, agent: { ...input.agent, articlesPerRun: requiredCount } });

  const response = await client.chat.completions.create({
    model: getModel(),
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0.25,
    max_tokens: 3500
  });

  const raw = response.choices?.[0]?.message?.content ?? "{}";
  let parsed: MarketOutput;

  try {
    parsed = parseMarketOutput(raw, requiredCount, input.candidates.length);
  } catch (error) {
    console.error("Failed to parse market LLM output:", raw);
    throw new Error(`Failed to parse market dashboard response: ${(error as Error).message}`);
  }

  const now = new Date().toISOString();
  const regionLabel = input.region === "au" ? "Australia (Perth)" : "Americas (Houston)";

  const selectedArticles: SelectedArticle[] = parsed.selectedArticles.map((item) => {
    const candidate = input.candidates[item.candidateIndex - 1];
    if (!candidate) {
      throw new Error(`Invalid candidateIndex ${item.candidateIndex}`);
    }
    const briefNote = item.whySelected ? `${candidate.briefContent} ${item.whySelected}` : candidate.briefContent;
    return {
      title: candidate.title,
      url: candidate.url,
      briefContent: briefNote,
      imageUrl: candidate.imageUrl,
      imageAlt: item.imageAlt || candidate.title,
      sourceName: candidate.sourceName,
      sourceIndex: item.candidateIndex
    };
  });

  const heroArticle = selectHeroArticle(selectedArticles, parsed.heroCandidateIndex);

  const marketIndicators: BriefMarketIndicator[] = parsed.marketIndicators
    .map((m) => {
      const match = input.indices.find((idx) => idx.id === m.indexId);
      if (!match) return null;
      return { id: match.id, label: match.label, url: match.url, note: m.note || "" };
    })
    .filter((m): m is NonNullable<typeof m> => Boolean(m));

  const bodyMarkdown = renderBriefMarkdown({
    title: parsed.title,
    summary: parsed.summary,
    regionLabel,
    portfolioLabel: input.agent.label,
    runWindow: input.runWindow,
    publishedAtISO: now,
    selectedArticles,
    highlights: parsed.highlights,
    procurementActions: parsed.procurementActions,
    watchlist: parsed.watchlist,
    topStoriesTitle: "## 📚 Top Source Articles",
    marketIndicators,
    region: input.region
  });

  const sources = new Set<string>([
    ...selectedArticles.map((a) => a.url),
    ...marketIndicators.map((i) => i.url)
  ]);

  return {
    postId: crypto.randomUUID(),
    title: parsed.title,
    region: input.region,
    portfolio: input.agent.portfolio,
    runWindow: input.runWindow,
    status: "draft",
    publishedAt: now,
    summary: parsed.summary,
    bodyMarkdown,
    sources: Array.from(sources),
    highlights: parsed.highlights,
    procurementActions: parsed.procurementActions,
    watchlist: parsed.watchlist,
    marketIndicators,
    selectedArticles,
    heroImageUrl: heroArticle?.imageUrl,
    heroImageSourceUrl: heroArticle?.url,
    heroImageAlt: heroArticle?.title,
    tags: ["market-dashboard", "lng", "oil-gas"]
  };
}
