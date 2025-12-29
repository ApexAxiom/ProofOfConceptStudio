import crypto from "node:crypto";
import { OpenAI } from "openai";
import {
  buildPrompt,
  PromptInput,
  ArticleInput,
  BriefOutput,
  parsePromptOutput,
  requiredArticleCount
} from "./prompts.js";
import { BriefPost, SelectedArticle } from "@proof/shared";
import { renderBriefMarkdown } from "./render.js";

const openaiApiKey = process.env.OPENAI_API_KEY;
const client = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;
// Default to gpt-4o-mini for cost efficiency; override via OPENAI_MODEL
const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

/**
 * Generates a brief from the provided articles using OpenAI.
 * Ensures exact article URLs are preserved and linked.
 */
export async function generateBrief(input: PromptInput): Promise<BriefPost> {
  if (!client) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const requiredCount = Math.min(requiredArticleCount(input.agent), Math.max(1, input.articles.length));
  const prompt = buildPrompt(input);
  
  const response = await client.chat.completions.create({
    model,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0.7, // Balanced between creativity and consistency
    max_tokens: 3000
  });
  
  const raw = response.choices?.[0]?.message?.content ?? "{}";
  let parsed: BriefOutput;
  
  try {
    parsed = parsePromptOutput(raw, requiredCount);
  } catch (error) {
    console.error("Failed to parse LLM output:", raw);
    throw new Error(`Failed to parse LLM response: ${(error as Error).message}`);
  }

  const now = new Date().toISOString();
  const regionLabel = input.region === "au" ? "Australia (Perth)" : "Americas (Houston)";

  const selectedArticles: SelectedArticle[] = parsed.selectedArticles.map((article) => {
    const idx = article.articleIndex - 1;
    const inputArticle = input.articles[idx];
    if (!inputArticle) {
      throw new Error(`Invalid articleIndex ${article.articleIndex} from LLM`);
    }
    return {
      title: inputArticle.title,
      url: inputArticle.url,
      briefContent: article.briefContent,
      categoryImportance: article.categoryImportance,
      keyMetrics: article.keyMetrics,
      imageUrl: inputArticle.ogImageUrl,
      imageAlt: article.imageAlt || inputArticle.title,
      sourceName: inputArticle.sourceName,
      publishedAt: inputArticle.publishedAt
    };
  });

  const heroArticle = selectedArticles.find((_, idx) => idx + 1 === parsed.heroSelection.articleIndex) || selectedArticles[0];

  const marketIndicators = parsed.marketIndicators
    .map((m) => {
      const match = input.indices.find((idx) => idx.id === m.indexId);
      if (!match) return null;
      return { ...match, note: m.note || "" };
    })
    .filter((m): m is NonNullable<typeof m> => Boolean(m));

  const bodyMarkdown = renderBriefMarkdown({
    title: parsed.title || `Brief - ${input.agent.label}`,
    summary: parsed.summary || "",
    regionLabel,
    portfolioLabel: input.agent.label,
    runWindow: input.runWindow,
    publishedAtISO: now,
    selectedArticles,
    marketIndicators: marketIndicators.map((mi) => ({ label: mi.label, url: mi.url, note: mi.note }))
  });

  const sourceUrls = new Set<string>([
    ...selectedArticles.map((a) => a.url),
    ...marketIndicators.map((idx) => idx.url)
  ]);

  return {
    postId: crypto.randomUUID(),
    title: parsed.title || `Brief - ${input.agent.label}`,
    region: input.region,
    portfolio: input.agent.portfolio,
    runWindow: input.runWindow,
    status: "draft",
    publishedAt: now,
    summary: parsed.summary,
    bodyMarkdown,
    sources: Array.from(sourceUrls),
    selectedArticles,
    heroImageUrl: heroArticle?.imageUrl,
    heroImageSourceUrl: heroArticle?.url,
    heroImageAlt: heroArticle?.title || parsed.title
  };
}

export { PromptInput, ArticleInput };
