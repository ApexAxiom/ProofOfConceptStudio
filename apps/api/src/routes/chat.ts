import { FastifyPluginAsync } from "fastify";
import { AgentFeed, BriefPost, portfolioLabel } from "@proof/shared";
import { getRegionPosts } from "../db/posts.js";
import { OpenAI } from "openai";
const openaiApiKey = process.env.OPENAI_API_KEY;
const openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;
// Default to a widely-available quality model; override via OPENAI_MODEL.
const model = process.env.OPENAI_MODEL || "gpt-4o";
const MAX_CONTEXT_CHARS = 100_000; // ~25k token budget
const MAX_COMPLETION_TOKENS = 1000;
const RUNNER_BASE_URL = process.env.RUNNER_BASE_URL ?? "http://localhost:3002";

type AgentSummary = {
  id: string;
  portfolio: string;
  label: string;
  description?: string;
  articlesPerRun: number;
  feedsByRegion: Record<string, AgentFeed[]>;
};

async function findAgent(agentId?: string, portfolio?: string) {
  if (!agentId && !portfolio) return undefined;
  try {
    const res = await fetch(`${RUNNER_BASE_URL}/agents`);
    if (!res.ok) return undefined;
    const payload = (await res.json()) as { agents?: AgentSummary[] };
    return payload.agents?.find((a) => a.id === agentId || a.portfolio === portfolio);
  } catch (err) {
    console.warn("Unable to load agent catalog", (err as Error).message);
    return undefined;
  }
}

const chatRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/status", async () => ({
    enabled: Boolean(openaiApiKey),
    model: openaiApiKey ? model : null,
    runnerConfigured: Boolean(RUNNER_BASE_URL)
  }));

  fastify.post("/", async (request, reply) => {
    const { question, region, portfolio, agentId } = request.body as any;
    if (!region || !portfolio || !question) {
      reply.code(400).send({ error: "question, region, and portfolio are required" });
      return;
    }

    const agent = await findAgent(agentId, portfolio);
    const regionPosts = await getRegionPosts(region);
    const filtered = regionPosts.filter((p) => p.portfolio === portfolio);
    const candidatePosts = filtered.length ? filtered : regionPosts;

    const contextBlocks: string[] = [];
    const selectedPosts: BriefPost[] = [];
    let usedChars = 0;
    for (const post of candidatePosts) {
      const block = `${post.title}\n${post.bodyMarkdown}\nSources: ${(post.sources || []).join(", ")}`;
      if (usedChars + block.length > MAX_CONTEXT_CHARS) break;
      selectedPosts.push(post);
      contextBlocks.push(block);
      usedChars += block.length;
    }

    if (selectedPosts.length === 0) {
      return { answer: "No briefs are available yet. Please run an ingestion cycle and try again." };
    }

    const allowedSources = new Set<string>(selectedPosts.flatMap((p) => p.sources || []));
    const context = contextBlocks.join("\n\n---\n\n");

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
      return { answer: buildFallbackAnswer(selectedPosts) };
    }

    try {
      const assistantIdentity = agent
        ? `${agent.label} category management advisor (${portfolioLabel(agent.portfolio)})`
        : `${portfolioLabel(portfolio)} category management advisor`;
      const prompt = `You are ${assistantIdentity} focused on negotiation tactics, supplier strategy, and sourcing risk controls. Use the following briefs to answer in Markdown with bullet points and short paragraphs. Every factual statement must include a citation using only the provided URLs. Do not emit HTML. If you lack a citation, state that the information is unavailable. Do not output any URL that is not in Allowed URLs. Keep answers concise (max ${MAX_COMPLETION_TOKENS} tokens).\n\nAllowed URLs:\n${Array.from(allowedSources).join("\n")}\n\nBriefs:\n${context}\n\nQuestion: ${question}`;
      const response = await openai.chat.completions.create({
        model,
        max_tokens: MAX_COMPLETION_TOKENS,
        messages: [{ role: "user", content: prompt }]
      });
      const answer = response.choices?.[0]?.message?.content ?? "";
      const urlRegex = /https?:\/\/[^\s)]+/g;
      const found = new Set<string>(answer.match(urlRegex) ?? []);
      const disallowed = [...found].filter((u) => !allowedSources.has(u));
      const hasAllowed = [...found].some((u) => allowedSources.has(u));

      if (!hasAllowed || disallowed.length > 0) {
        return { answer: buildFallbackAnswer(selectedPosts) };
      }

      return { answer };
    } catch (err) {
      request.log.error({ err }, "AI call failed; using fallback answer");
      return { answer: buildFallbackAnswer(selectedPosts) };
    }
  });
};

export default chatRoutes;
