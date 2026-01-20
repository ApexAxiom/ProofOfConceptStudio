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
const PROOF_OF_CONCEPT_STUDIO_URL = "https://proofofconceptstudio.com";
const MAX_WEB_DOCS = 3;
const MAX_WEB_DOC_CHARS = 2200;
const MAX_WEB_CONTEXT_CHARS = 8000;
const SEARCH_TIMEOUT_MS = 5000;
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

type ExternalContext = {
  blocks: string[];
  urls: string[];
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

function isWebSearchEnabled() {
  return process.env.WEB_SEARCH_ENABLED !== "false";
}

function stripHtml(raw: string) {
  return raw
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTitle(html: string) {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match ? match[1].trim() : undefined;
}

function extractUrlsFromSitemap(xml: string) {
  return Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/gi)).map((match) => match[1].trim());
}

function uniqueStrings(values: string[]) {
  return [...new Set(values)];
}

function extractUrlsFromText(text: string) {
  const urlRegex = /https?:\/\/[^\s)]+/g;
  return text.match(urlRegex) ?? [];
}

function summarizeContent(content: string, maxChars: number) {
  if (content.length <= maxChars) return content;
  return `${content.slice(0, maxChars).trim()}…`;
}

function keywordTokens(question: string) {
  const tokens = question.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  const filtered = tokens.filter((token) => token.length > 3);
  return uniqueStrings(filtered).slice(0, 8);
}

async function fetchWithTimeout(url: string, timeoutMs = SEARCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function resolveDuckDuckGoUrl(rawUrl: string) {
  if (!rawUrl.includes("duckduckgo.com/l/")) return rawUrl;
  try {
    const parsed = new URL(rawUrl);
    const target = parsed.searchParams.get("uddg");
    return target ? decodeURIComponent(target) : rawUrl;
  } catch {
    return rawUrl;
  }
}

async function fetchDuckDuckGoResults(query: string) {
  const res = await fetchWithTimeout(
    `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
    SEARCH_TIMEOUT_MS
  );
  if (!res.ok) return [];
  const html = await res.text();
  const matches = Array.from(html.matchAll(/<a[^>]+class="result__a"[^>]+href="([^"]+)"/g));
  const urls = matches.map((match) => resolveDuckDuckGoUrl(match[1]));
  return uniqueStrings(urls.filter((url) => url.startsWith("http")));
}

async function fetchReadableText(url: string) {
  const jinaUrl = `https://r.jina.ai/http://${url.replace(/^https?:\/\//, "")}`;
  const res = await fetchWithTimeout(jinaUrl, SEARCH_TIMEOUT_MS);
  if (!res.ok) return null;
  const text = await res.text();
  return stripHtml(text);
}

async function buildProofOfConceptContext(question: string): Promise<ExternalContext> {
  const candidates = [
    `${PROOF_OF_CONCEPT_STUDIO_URL}/sitemap.xml`,
    `${PROOF_OF_CONCEPT_STUDIO_URL}/sitemap_index.xml`,
    `${PROOF_OF_CONCEPT_STUDIO_URL}/wp-sitemap.xml`
  ];
  let urls: string[] = [];
  for (const sitemapUrl of candidates) {
    try {
      const res = await fetchWithTimeout(sitemapUrl, SEARCH_TIMEOUT_MS);
      if (!res.ok) continue;
      const xml = await res.text();
      urls = extractUrlsFromSitemap(xml);
      if (urls.length) break;
    } catch {
      continue;
    }
  }
  if (!urls.length) {
    return { blocks: [], urls: [] };
  }

  const tokens = keywordTokens(question);
  const scored = urls
    .filter((url) => url.includes("proofofconceptstudio.com"))
    .map((url) => ({
      url,
      score: tokens.reduce((acc, token) => (url.toLowerCase().includes(token) ? acc + 1 : acc), 0)
    }))
    .sort((a, b) => b.score - a.score);
  const topUrls = scored.slice(0, MAX_WEB_DOCS).map((item) => item.url);

  const blocks: string[] = [];
  for (const url of topUrls) {
    try {
      const raw = await fetchWithTimeout(url, SEARCH_TIMEOUT_MS);
      const html = await raw.text();
      const title = extractTitle(html) ?? "ProofOfConceptStudio.com";
      const text = stripHtml(html);
      const excerpt = summarizeContent(text, MAX_WEB_DOC_CHARS);
      blocks.push(`Title: ${title}\nURL: ${url}\nExcerpt: ${excerpt}`);
    } catch {
      continue;
    }
  }
  return { blocks, urls: topUrls };
}

async function buildWebSearchContext(
  question: string,
  region: string,
  portfolio: string
): Promise<ExternalContext> {
  if (!isWebSearchEnabled()) {
    return { blocks: [], urls: [] };
  }
  const query = `${question} ${portfolioLabel(portfolio)} ${region}`;
  try {
    const results = await fetchDuckDuckGoResults(query);
    const filtered = results.filter((url) => !url.includes("proofofconceptstudio.com")).slice(0, MAX_WEB_DOCS);
    const blocks: string[] = [];
    const urls: string[] = [];
    for (const url of filtered) {
      const text = await fetchReadableText(url);
      if (!text) continue;
      const excerpt = summarizeContent(text, MAX_WEB_DOC_CHARS);
      blocks.push(`URL: ${url}\nExcerpt: ${excerpt}`);
      urls.push(url);
    }
    return { blocks, urls };
  } catch {
    return { blocks: [], urls: [] };
  }
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

    const proofContext = await buildProofOfConceptContext(effectiveQuestion);
    const webContext = await buildWebSearchContext(effectiveQuestion, region, portfolio);
    const allowedSources = new Set<string>([
      ...selectedPosts.flatMap((p) => p.sources || []),
      ...proofContext.urls,
      ...webContext.urls
    ]);
    const context = contextBlocks.join("\n\n---\n\n");
    const externalSections: string[] = [];
    let externalChars = 0;
    if (proofContext.blocks.length > 0) {
      const section = `ProofOfConceptStudio.com context:\n${proofContext.blocks.join("\n\n")}`;
      externalSections.push(section);
      externalChars += section.length;
    }
    if (webContext.blocks.length > 0 && externalChars < MAX_WEB_CONTEXT_CHARS) {
      const remaining = MAX_WEB_CONTEXT_CHARS - externalChars;
      const section = `Web search context:\n${webContext.blocks.join("\n\n")}`;
      externalSections.push(section.slice(0, remaining));
      externalChars += section.length;
    }

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
      const answer = buildFallbackAnswer(selectedPosts, "AI is not configured.");
      return { answer, sources: uniqueStrings(extractUrlsFromText(answer)) };
    }

    const assistantIdentity = agent
      ? `${agent.label} category management advisor (${portfolioLabel(agent.portfolio)})`
      : `${portfolioLabel(portfolio)} category management advisor`;
    const systemMessage = [
      "You are ProofOfConceptStudio Chat Analyst.",
      "Be concise, factual, and do not invent provenance.",
      "Reason from first principles: demand drivers, supply constraints, cost structure, and risk controls.",
      "Prioritize sources in this order: ProofOfConceptStudio.com, then briefs, then web search context.",
      "If the user asks about a specific brief id or URL and none is provided, ask for it.",
      "If sources are missing, say so.",
      "No hallucinated citations.",
      `You are ${assistantIdentity} focused on negotiation tactics, supplier strategy, and sourcing risk controls.`,
      "Use Markdown with bullet points and short paragraphs.",
      "Every factual statement must include a citation using only the provided URLs.",
      "Do not emit HTML. Do not output any URL that is not in Allowed URLs."
    ].join(" ");
    const promptSections = [
      `Allowed URLs:\n${Array.from(allowedSources).join("\n")}`,
      "Briefs:",
      context
    ];
    if (externalSections.length > 0) {
      promptSections.push(...externalSections);
    }
    const prompt = `${promptSections.join("\n\n")}\n\nQuestion: ${effectiveQuestion}`;
    const requestChatCompletion = (modelOverride?: string) =>
      openai.chat.completions.create({
        model: modelOverride ?? getModel(),
        max_tokens: getMaxOutputTokens(),
        messages: [
          { role: "system", content: systemMessage },
          { role: "user", content: prompt }
        ]
      });

    try {
      const response = await requestChatCompletion();
      const answer = response.choices?.[0]?.message?.content ?? "";
      const found = new Set<string>(extractUrlsFromText(answer));
      const disallowed = [...found].filter((u) => !allowedSources.has(u));
      const hasAllowed = [...found].some((u) => allowedSources.has(u));

      if (!hasAllowed || disallowed.length > 0) {
        const timingMs = Date.now() - startMs;
        request.log.info(
          { ...logContext, timingMs, result: "fallback", openaiRequestId: response.id },
          "AI response failed citation checks; returning fallback"
        );
        const fallback = buildFallbackAnswer(selectedPosts, "AI response was missing verified citations.");
        return { answer: fallback, sources: uniqueStrings(extractUrlsFromText(fallback)) };
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
      return { answer, sources: uniqueStrings([...found]) };
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
      if (isNotFound && getModel() !== DEFAULT_MODEL) {
        request.log.warn(
          { ...logContext, timingMs, result: "retry", model: getModel(), fallbackModel: DEFAULT_MODEL },
          "AI model not found; retrying with default model"
        );
        try {
          const response = await requestChatCompletion(DEFAULT_MODEL);
          const answer = response.choices?.[0]?.message?.content ?? "";
          const found = new Set<string>(extractUrlsFromText(answer));
          const disallowed = [...found].filter((u) => !allowedSources.has(u));
          const hasAllowed = [...found].some((u) => allowedSources.has(u));

          if (!hasAllowed || disallowed.length > 0) {
            request.log.info(
              { ...logContext, timingMs, result: "fallback", openaiRequestId: response.id },
              "AI response failed citation checks after model retry; returning fallback"
            );
            const fallback = buildFallbackAnswer(selectedPosts, "AI response was missing verified citations.");
            return { answer: fallback, sources: uniqueStrings(extractUrlsFromText(fallback)) };
          }

          request.log.info(
            { ...logContext, timingMs, openaiRequestId: response.id, result: "ok", model: DEFAULT_MODEL },
            "Chat response generated after model retry"
          );
          return { answer, sources: uniqueStrings([...found]) };
        } catch (retryErr) {
          request.log.error(
            { err: retryErr, ...logContext, timingMs, result: "error", model: DEFAULT_MODEL },
            "AI retry with default model failed"
          );
        }
      }
      if (isAuthError || isNotFound) {
        const fallback = buildFallbackAnswer(
          selectedPosts,
          "AI is temporarily unavailable due to configuration."
        );
        return { answer: fallback, sources: uniqueStrings(extractUrlsFromText(fallback)) };
      }
      const fallback = buildFallbackAnswer(selectedPosts, "AI response failed to generate.");
      return { answer: fallback, sources: uniqueStrings(extractUrlsFromText(fallback)) };
    }
  });
};

export default chatRoutes;
