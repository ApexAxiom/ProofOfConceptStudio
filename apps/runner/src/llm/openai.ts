import crypto from "node:crypto";
import { OpenAI } from "openai";
import { buildPrompt, PromptInput, ArticleInput, parsePromptOutput, BriefOutput } from "./prompts.js";
import { BriefPost, SelectedArticle } from "@proof/shared";

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
    parsed = parsePromptOutput(raw);
  } catch (error) {
    console.error("Failed to parse LLM output:", raw);
    throw new Error(`Failed to parse LLM response: ${(error as Error).message}`);
  }
  
  const now = new Date().toISOString();
  
  // Build the selected articles with validated URLs
  const selectedArticles: SelectedArticle[] = (parsed.selectedArticles || []).map((article) => {
    // Find the matching input article to ensure URL is preserved exactly
    const matchingInput = input.articles.find(
      (a) => a.url === article.url || a.title === article.title
    );
    
    return {
      title: article.title,
      url: matchingInput?.url || article.url, // Prefer the exact input URL
      briefContent: article.briefContent,
      imageUrl: article.imageUrl || matchingInput?.ogImageUrl,
      imageAlt: article.imageAlt || article.title,
      sourceName: article.sourceName || matchingInput?.sourceName,
      publishedAt: matchingInput?.publishedAt
    };
  });
  
  // Determine the hero image from the selected articles
  const heroIndex = Math.min(parsed.heroArticleIndex || 0, selectedArticles.length - 1);
  const heroArticle = selectedArticles[heroIndex] || selectedArticles[0];
  
  // Find the best hero image from selected articles
  const heroImageUrl = findBestHeroImage(selectedArticles, input.articles);
  const heroImageSource = selectedArticles.find((a) => 
    input.articles.find((ia) => ia.url === a.url)?.ogImageUrl === heroImageUrl
  );
  
  return {
    postId: crypto.randomUUID(),
    title: parsed.title || `Brief - ${input.agent.label}`,
    region: input.region,
    portfolio: input.agent.portfolio,
    runWindow: input.runWindow,
    status: "draft",
    publishedAt: now,
    summary: parsed.summary,
    bodyMarkdown: parsed.bodyMarkdown,
    sources: parsed.sources || selectedArticles.map((a) => a.url),
    selectedArticles,
    heroImageUrl,
    heroImageSourceUrl: heroImageSource?.url || heroArticle?.url,
    heroImageAlt: heroArticle?.title || parsed.title
  };
}

/**
 * Finds the best hero image from the selected articles
 */
function findBestHeroImage(selectedArticles: SelectedArticle[], inputArticles: ArticleInput[]): string | undefined {
  // First try to find an image from selected articles
  for (const selected of selectedArticles) {
    if (selected.imageUrl && selected.imageUrl.startsWith("https")) {
      return selected.imageUrl;
    }
    
    // Check the matching input article
    const inputMatch = inputArticles.find((a) => a.url === selected.url);
    if (inputMatch?.ogImageUrl && inputMatch.ogImageUrl.startsWith("https")) {
      return inputMatch.ogImageUrl;
    }
  }
  
  // Fall back to any article with a valid image
  for (const article of inputArticles) {
    if (article.ogImageUrl && article.ogImageUrl.startsWith("https")) {
      return article.ogImageUrl;
    }
  }
  
  return undefined;
}

export { PromptInput, ArticleInput };
