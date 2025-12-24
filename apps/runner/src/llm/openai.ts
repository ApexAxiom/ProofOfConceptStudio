import crypto from "node:crypto";
import { OpenAI } from "openai";
import { buildPrompt, PromptInput } from "./prompts.js";
import { BriefPost } from "@proof/shared";

const openaiApiKey = process.env.OPENAI_API_KEY;
const client = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;
// Default to a widely-available model; override via OPENAI_MODEL.
const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

export async function generateBrief(input: PromptInput): Promise<BriefPost> {
  if (!client) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  const prompt = buildPrompt(input);
  const response = await client.responses.create({
    model,
    input: prompt,
    response_format: { type: "json_object" }
  });
  const raw = response.output_text || "{}";
  const parsed = JSON.parse(raw);
  const now = new Date().toISOString();
  return {
    postId: parsed.postId || crypto.randomUUID(),
    title: parsed.title || `Brief - ${input.agent.label}`,
    region: input.region,
    portfolio: input.agent.portfolio,
    runWindow: input.runWindow,
    status: "draft",
    publishedAt: now,
    summary: parsed.summary,
    bodyMarkdown: parsed.bodyMarkdown,
    sources: parsed.sources || []
  };
}
