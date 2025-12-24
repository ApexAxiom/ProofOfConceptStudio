import { FastifyPluginAsync } from "fastify";
import { BriefPost } from "@proof/shared";
import { getRegionPosts } from "../db/posts.js";
import { OpenAI } from "openai";
const openaiApiKey = process.env.OPENAI_API_KEY;
const openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;
// Default to a widely-available model; override via OPENAI_MODEL.
const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

const chatRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/", async (request, reply) => {
    const { question, region, portfolio } = request.body as any;
    if (!region || !portfolio || !question) {
      reply.code(400).send({ error: "question, region, and portfolio are required" });
      return;
    }

    const regionPosts = await getRegionPosts(region);
    const filtered = regionPosts.filter((p) => p.portfolio === portfolio);
    const recent = (filtered.length ? filtered : regionPosts).slice(0, 10);

    if (recent.length === 0) {
      return { answer: "No briefs are available yet. Please run an ingestion cycle and try again." };
    }

    const allowedSources = new Set<string>(recent.flatMap((p) => p.sources || []));
    const context = recent
      .map((p) => `${p.title}\n${p.bodyMarkdown}\nSources: ${(p.sources || []).join(", ")}`)
      .join("\n\n---\n\n");

    const buildFallbackAnswer = (posts: BriefPost[]) => {
      const bullets = posts.slice(0, 3).map((p) => {
        const source = p.sources?.[0];
        const detail = p.summary ?? p.bodyMarkdown;
        return source
          ? `- **${p.title}** — ${detail} ([source](${source}))`
          : `- **${p.title}** — ${detail}`;
      });
      return [
        "AI model is not configured, so here are the latest briefs we have:",
        ...bullets,
        "Ask again once ingestion and AI credentials are configured for richer answers."
      ].join("\n");
    };

    if (!openai) {
      return { answer: buildFallbackAnswer(recent) };
    }

    try {
      const prompt = `You are a procurement assistant. Use the following briefs to answer in Markdown with bullet points and short paragraphs. Every factual statement must include a citation using only the provided URLs. Do not emit HTML. If you lack a citation, state that the information is unavailable. Do not output any URL that is not in Allowed URLs. If you are unsure, do not cite it.\n\nAllowed URLs:\n${Array.from(allowedSources).join("\n")}\n\nBriefs:\n${context}\n\nQuestion: ${question}`;
      const response = await openai.chat.completions.create({
        model,
        messages: [{ role: "user", content: prompt }]
      });
      const answer = response.choices?.[0]?.message?.content ?? "";
      const urlRegex = /https?:\/\/[^\s)]+/g;
      const found = new Set<string>(answer.match(urlRegex) ?? []);
      const disallowed = [...found].filter((u) => !allowedSources.has(u));
      const hasAllowed = [...found].some((u) => allowedSources.has(u));

      if (!hasAllowed || disallowed.length > 0) {
        return { answer: buildFallbackAnswer(recent) };
      }

      return { answer };
    } catch (err) {
      request.log.error({ err }, "AI call failed; using fallback answer");
      return { answer: buildFallbackAnswer(recent) };
    }
  });
};

export default chatRoutes;
