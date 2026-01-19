import { FastifyPluginAsync } from "fastify";
import { AgentFeed, BriefPost, portfolioLabel } from "@proof/shared";
import { getRegionPosts } from "../db/posts.js";
import { OpenAI } from "openai";

const DEFAULT_MODEL = "gpt-4o";
const MAX_CONTEXT_CHARS = 100_000; // ~25k token budget
const DEFAULT_MAX_COMPLETION_TOKENS = 1000;
const MAX_QUESTION_CHARS = 4000;
const MAX_MESSAGE_COUNT = 20;
const FALLBACK_AGENT_URL = "http://localhost:3002";
const RATE_LIMIT_STATE = new Map<string, { tokens: number; lastRefillMs: number }>();
let cachedOpenAIKey: string | null = null;
let cachedOpenAI: OpenAI | null = null;

type AgentSummary = {
  id: string;
  portfolio: string;
  label: string;
  description?: string;
  articlesPerRun: number;
  feedsByRegion: Record<string, AgentFeed[]>;
};

type IncomingMessage = {
  role?: string;
  content?: string;
};

function getRunnerBaseUrl() {
  return process.env.RUNNER_BASE_URL ?? FALLBACK_AGENT_URL;
}

function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  if (cachedOpenAI && cachedOpenAIKey === apiKey) return cachedOpenAI;
  cachedOpenAIKey = apiKey;
  cachedOpenAI = new OpenAI({ apiKey });
  return cachedOpenAI;
}

function getModel() {
  return process.env.OPENAI_MODEL || DEFAULT_MODEL;
}

function getMaxOutputTokens() {
  const value = Number(process.env.OPENAI_MAX_OUTPUT_TOKENS ?? DEFAULT_MAX_COMPLETION_TOKENS);
  if (Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }
  return DEFAULT_MAX_COMPLETION_TOKENS;
}

function getDebugChatLogging() {
  return process.env.DEBUG_CHAT_LOGGING === "true";
}

function getRateLimitConfig() {
  const rpm = Number(process.env.CHAT_RATE_LIMIT_RPM ?? 30);
  const burst = Number(process.env.CHAT_RATE_LIMIT_BURST ?? 10);
  return {
    rpm: Number.isFinite(rpm) && rpm > 0 ? rpm : 30,
    burst: Number.isFinite(burst) && burst > 0 ? burst : 10
  };
}

function checkRateLimit(clientIp: string) {
  const now = Date.now();
  const { rpm, burst } = getRateLimitConfig();
  const state = RATE_LIMIT_STATE.get(clientIp) ?? { tokens: burst, lastRefillMs: now };
  const elapsedMinutes = (now - state.lastRefillMs) / 60000;
  const refill = elapsedMinutes * rpm;
  const nextTokens = Math.min(burst, state.tokens + refill);
  state.tokens = nextTokens;
  state.lastRefillMs = now;

  if (state.tokens < 1) {
    RATE_LIMIT_STATE.set(clientIp, state);
    return false;
  }

  state.tokens -= 1;
  RATE_LIMIT_STATE.set(clientIp, state);
  return true;
}

function buildLogContext(params: {
  conversationId?: string;
  region?: string;
  portfolio?: string;
  agentId?: string;
  messagesCount?: number;
  questionLength?: number;
}) {
  return {
    route: "/chat",
    conversationId: params.conversationId,
    region: params.region,
    portfolio: params.portfolio,
    agentId: params.agentId,
    messagesCount: params.messagesCount,
    questionLength: params.questionLength
  };
}

async function findAgent(agentId?: string, portfolio?: string) {
  if (!agentId && !portfolio) return undefined;
  const runnerBaseUrl = getRunnerBaseUrl();
  try {
    const res = await fetch(`${runnerBaseUrl}/agents`);
    if (!res.ok) return undefined;
    const payload = (await res.json()) as { agents?: AgentSummary[] };
    return payload.agents?.find((a) => a.id === agentId || a.portfolio === portfolio);
  } catch (err) {
    console.warn("Unable to load agent catalog", (err as Error).message);
    return undefined;
  }
}

/**
 * Chat routes for AI responses and status.
 */
const chatRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/status", async () => ({
    enabled: Boolean(process.env.OPENAI_API_KEY),
    model: process.env.OPENAI_API_KEY ? getModel() : null,
    runnerConfigured: Boolean(process.env.RUNNER_BASE_URL)
  }));

  fastify.post("/", async (request, reply) => {
    const startMs = Date.now();
    const { question, region, portfolio, agentId, messages, conversationId } = request.body as any;
    const clientIp =
      request.ip ||
      request.headers["x-forwarded-for"]?.toString().split(",")[0].trim() ||
      "unknown";

    if (!checkRateLimit(clientIp)) {
      request.log.warn(
        { route: "/chat", clientIp, result: "rate_limited" },
        "Chat rate limit exceeded"
      );
      reply.code(429).send({ error: "Rate limit exceeded. Please try again shortly." });
      return;
    }

    const incomingMessages = Array.isArray(messages) ? (messages as IncomingMessage[]) : [];
    const lastUserMessage = [...incomingMessages]
      .reverse()
      .find((message) => message?.role === "user" && typeof message.content === "string");
    const effectiveQuestion =
      typeof question === "string" && question.trim().length > 0
        ? question.trim()
        : lastUserMessage?.content?.trim();

    if (!region || !portfolio || !effectiveQuestion) {
      reply.code(400).send({ error: "question, region, and portfolio are required" });
      return;
    }

    if (incomingMessages.length > MAX_MESSAGE_COUNT) {
      reply.code(400).send({ error: `messages cannot exceed ${MAX_MESSAGE_COUNT} entries` });
      return;
    }

    if (effectiveQuestion.length > MAX_QUESTION_CHARS) {
      reply.code(400).send({ error: `question exceeds ${MAX_QUESTION_CHARS} characters` });
      return;
    }

    const logContext = buildLogContext({
      conversationId,
      region,
      portfolio,
      agentId,
      messagesCount: incomingMessages.length || undefined,
      questionLength: effectiveQuestion.length
    });

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
      const timingMs = Date.now() - startMs;
      request.log.info(
        { ...logContext, timingMs, result: "fallback" },
        "No briefs available; returning fallback answer"
      );
      return { answer: "No briefs are available yet. Please run an ingestion cycle and try again." };
    }

    const allowedSources = new Set<string>(selectedPosts.flatMap((p) => p.sources || []));
    const context = contextBlocks.join("\n\n---\n\n");

    const buildFallbackAnswer = (posts: BriefPost[], reason: string) => {
      const bullets = posts.slice(0, 3).map((p) => {
        const source = p.sources?.[0];
        const detail = p.summary ?? p.bodyMarkdown;
        return source
          ? `- **${p.title}** - ${detail} ([source](${source}))`
          : `- **${p.title}** - ${detail}`;
      });
      return [
        `${reason} Showing the latest briefs we have instead:`,
        ...bullets,
        "Ask again once ingestion and AI credentials are configured for richer answers."
      ].join("\n");
    };

    const openai = getOpenAIClient();
    if (!openai) {
      const timingMs = Date.now() - startMs;
      request.log.error(
        { ...logContext, timingMs, result: "fallback" },
        "Missing OPENAI_API_KEY; returning fallback answer"
      );
      return { answer: buildFallbackAnswer(selectedPosts, "AI is not configured.") };
    }

    try {
      const assistantIdentity = agent
        ? `${agent.label} category management advisor (${portfolioLabel(agent.portfolio)})`
        : `${portfolioLabel(portfolio)} category management advisor`;
      const systemMessage = [
        "You are ProofOfConceptStudio Chat Analyst.",
        "Be concise, factual, and do not invent provenance.",
        "Never claim to browse external sites; you only know the provided briefs context.",
        "If the user asks about a specific brief id or URL and none is provided, ask for it.",
        "If sources are missing, say so.",
        "No hallucinated citations.",
        `You are ${assistantIdentity} focused on negotiation tactics, supplier strategy, and sourcing risk controls.`,
        "Use Markdown with bullet points and short paragraphs.",
        "Every factual statement must include a citation using only the provided URLs.",
        "Do not emit HTML. Do not output any URL that is not in Allowed URLs."
      ].join(" ");
      const prompt = `Allowed URLs:\n${Array.from(allowedSources).join("\n")}\n\nBriefs:\n${context}\n\nQuestion: ${effectiveQuestion}`;
      const maxTokens = getMaxOutputTokens();
      const response = await openai.chat.completions.create({
        model: getModel(),
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: systemMessage },
          { role: "user", content: prompt }
        ]
      });
      const answer = response.choices?.[0]?.message?.content ?? "";
      const urlRegex = /https?:\/\/[^\s)]+/g;
      const found = new Set<string>(answer.match(urlRegex) ?? []);
      const disallowed = [...found].filter((u) => !allowedSources.has(u));
      const hasAllowed = [...found].some((u) => allowedSources.has(u));

      if (!hasAllowed || disallowed.length > 0) {
        const timingMs = Date.now() - startMs;
        request.log.info(
          { ...logContext, timingMs, result: "fallback", openaiRequestId: response.id },
          "AI response failed citation checks; returning fallback"
        );
        return { answer: buildFallbackAnswer(selectedPosts, "AI response was missing verified citations.") };
      }

      const timingMs = Date.now() - startMs;
      const debug = getDebugChatLogging();
      request.log.info(
        {
          ...logContext,
          timingMs,
          openaiRequestId: response.id,
          result: "ok",
          questionPreview: debug ? effectiveQuestion.slice(0, 300) : undefined
        },
        "Chat response generated"
      );
      return { answer };
    } catch (err) {
      const timingMs = Date.now() - startMs;
      const errorMessage = (err as Error)?.message ?? "Unknown error";
      const status = (err as { status?: number })?.status;
      const code = (err as { code?: string })?.code;
      const isAuthError = status === 401 || status === 403;
      const isNotFound = status === 404 || code === "model_not_found";
      request.log.error(
        { err, status, code, ...logContext, timingMs, result: "error" },
        "AI call failed; using fallback answer"
      );
      if (getDebugChatLogging()) {
        request.log.info({ ...logContext, timingMs, result: "error", errorMessage }, "Chat error detail");
      }
      if (isAuthError || isNotFound) {
        return {
          answer:
            "AI is temporarily unavailable due to configuration. Please verify OPENAI_API_KEY and OPENAI_MODEL."
        };
      }
      return { answer: buildFallbackAnswer(selectedPosts, "AI response failed to generate.") };
    }
  });
};

export default chatRoutes;
