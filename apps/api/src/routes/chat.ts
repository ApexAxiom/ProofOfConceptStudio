import { FastifyPluginAsync } from "fastify";
import {
  AgentFeed,
  BriefPost,
  BriefClaim,
  BriefSource,
  buildAgentSystemPrompt,
  getAgentFramework,
  keywordsForPortfolio,
  normalizeBriefSources,
  portfolioLabel
} from "@proof/shared";
import { getPost, getRegionPosts } from "../db/posts.js";
import { OpenAI } from "openai";

const DEFAULT_MODEL = "gpt-4o";
const MAX_CONTEXT_CHARS = 100_000; // ~25k token budget
const DEFAULT_MAX_COMPLETION_TOKENS = 1000;
const MAX_QUESTION_CHARS = 8000;
const MAX_MESSAGE_COUNT = 40;
const FALLBACK_AGENT_URL = "http://localhost:3002";
const PROOF_OF_CONCEPT_STUDIO_URL = "https://proofofconceptstudio.com";
const MAX_WEB_DOCS = 3;
const MAX_WEB_DOC_CHARS = 2200;
const MAX_WEB_CONTEXT_CHARS = 8000;
const SEARCH_TIMEOUT_MS = 5000;
const FALLBACK_MODELS = ["gpt-4o-mini"];
const RATE_LIMIT_STATE = new Map<string, { tokens: number; lastRefillMs: number }>();
let cachedOpenAIKey: string | null = null;
let cachedOpenAI: OpenAI | null = null;

type AgentSummary = {
  id: string;
  region?: string;
  portfolio: string;
  label: string;
  description?: string;
  maxArticlesToConsider?: number;
  articlesPerRun: number;
  feeds?: AgentFeed[];
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

const STOPWORDS = new Set([
  "the","and","for","with","that","this","from","into","over","under","about","while","when","where","which","what",
  "will","would","could","should","a","an","of","to","in","on","by","at","is","are","was","were","be","been","it",
  "as","or","if","than","then","but","so","we","they","their","our","your","its","these","those"
]);

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(
    (token) => token.length > 2 && !STOPWORDS.has(token)
  );
}

function scoreClaim(claim: BriefClaim, questionTokens: string[], categoryTokens: string[]): number {
  const evidenceText = (claim.evidence ?? []).map((e) => e.excerpt).join(" ");
  const haystack = new Set(tokenize(`${claim.text} ${evidenceText}`));
  const questionHits = questionTokens.filter((t) => haystack.has(t)).length;
  const categoryHits = categoryTokens.filter((t) => haystack.has(t)).length;
  return questionHits * 2 + categoryHits;
}

function selectRelevantClaims(
  claims: BriefClaim[],
  question: string,
  categoryTokens: string[],
  limit = 6
): BriefClaim[] {
  const questionTokens = tokenize(question);
  const supported = claims.filter((claim) => claim.status === "supported" && claim.evidence?.length);
  const pool = supported.length > 0 ? supported : claims;
  return [...pool]
    .map((claim) => ({ claim, score: scoreClaim(claim, questionTokens, categoryTokens) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.claim);
}

function getChatClaimLimit() {
  const value = Number(process.env.CHAT_MAX_CLAIMS ?? 6);
  return Number.isFinite(value) && value > 0 ? Math.round(value) : 6;
}

function buildEvidenceContext(claims: BriefClaim[], sourcesById: Map<string, BriefSource>): { blocks: string[]; citations: BriefSource[] } {
  const blocks: string[] = [];
  const citations: BriefSource[] = [];
  const seen = new Set<string>();

  for (const claim of claims) {
    const evidenceLines = (claim.evidence ?? [])
      .map((evidence) => {
        const source = sourcesById.get(evidence.sourceId);
        if (source && !seen.has(source.sourceId)) {
          seen.add(source.sourceId);
          citations.push(source);
        }
        return `- ${evidence.excerpt} (sourceId: ${evidence.sourceId}, url: ${evidence.url})`;
      })
      .join("\n");
    blocks.push(`Claim: ${claim.text}\nEvidence:\n${evidenceLines || "- [No evidence excerpt]"}`);
  }

  return { blocks, citations };
}

function renderFallbackAnswer(claims: BriefClaim[], sourcesById: Map<string, BriefSource>) {
  if (claims.length === 0) {
    return {
      answer: "No evidence-backed claims were available for this brief. Please verify the underlying sources.",
      citations: []
    };
  }

  const lines = ["Here are the most relevant evidence-backed points:", ""];
  const usedSources = new Map<string, BriefSource>();
  for (const claim of claims) {
    const evidence = claim.evidence?.[0];
    const source = evidence ? sourcesById.get(evidence.sourceId) : undefined;
    if (source) usedSources.set(source.sourceId, source);
    const citationText = source ? ` ([Source](${source.url}))` : "";
    lines.push(`- ${claim.text}${citationText}`);
  }

  return {
    answer: lines.join("\n"),
    citations: Array.from(usedSources.values())
  };
}

function extractSourceIds(text: string): string[] {
  const matches = Array.from(text.matchAll(/\[(src_[a-z0-9]+)\]/gi));
  return matches.map((m) => m[1].toLowerCase());
}

function replaceSourceIdsWithLinks(text: string, sourcesById: Map<string, BriefSource>): string {
  return text.replace(/\[(src_[a-z0-9]+)\]/gi, (match, id) => {
    const source = sourcesById.get(id.toLowerCase());
    if (!source) return match;
    return `[Source](${source.url})`;
  });
}

function getModelFallbacks() {
  return uniqueStrings([getModel(), DEFAULT_MODEL, ...FALLBACK_MODELS]).filter(Boolean);
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
  if (process.env.CHAT_RATE_LIMIT_DISABLED === "true") {
    return true;
  }
  const now = Date.now();
  const { rpm, burst } = getRateLimitConfig();
  if (rpm <= 0 || burst <= 0) {
    return true;
  }
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
  briefId?: string;
  region?: string;
  portfolio?: string;
  agentId?: string;
  messagesCount?: number;
  questionLength?: number;
}) {
  return {
    route: "/chat",
    conversationId: params.conversationId,
    briefId: params.briefId,
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
    const { question, region, portfolio, agentId, messages, conversationId, briefId } = request.body as any;
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
      briefId,
      region,
      portfolio,
      agentId,
      messagesCount: incomingMessages.length || undefined,
      questionLength: effectiveQuestion.length
    });

    const agent = await findAgent(agentId, portfolio);
    let targetBrief: BriefPost | null = null;
    if (briefId) {
      targetBrief = await getPost(briefId);
    }
    if (!targetBrief) {
      const regionPosts = await getRegionPosts(region);
      const filtered = regionPosts.filter((p) => p.portfolio === portfolio);
      targetBrief = filtered[0] ?? regionPosts[0] ?? null;
    }

    if (!targetBrief) {
      reply.code(404).send({ error: "No brief found for this region/portfolio." });
      return;
    }

    const effectiveLogContext = { ...logContext, briefId: briefId ?? targetBrief.postId };

    const normalizedSources = normalizeBriefSources(targetBrief.sources);
    const sourcesById = new Map<string, BriefSource>();
    normalizedSources.forEach((source) => sourcesById.set(source.sourceId, source));
    const claims = Array.isArray(targetBrief.claims) ? targetBrief.claims : [];
    if (claims.length === 0) {
      reply.code(200).send({
        answer: "This brief was published before evidence tracking was enabled, so citations are unavailable. Please open the brief sources directly for verification.",
        citations: [],
        sources: []
      });
      return;
    }
    const categoryTokens = keywordsForPortfolio(portfolio);
    const selectedClaims = selectRelevantClaims(claims, effectiveQuestion, categoryTokens, getChatClaimLimit());
    const evidenceContext = buildEvidenceContext(selectedClaims, sourcesById);
    const contextHeader = [
      `Brief Title: ${targetBrief.title}`,
      `Brief ID: ${targetBrief.postId}`,
      `Region: ${region}`,
      `Portfolio: ${portfolioLabel(targetBrief.portfolio)}`,
      `Published: ${targetBrief.publishedAt}`
    ].join("\n");
    const contextBlocks = [contextHeader, ...evidenceContext.blocks];
    const context = contextBlocks.join("\n\n---\n\n");

    const openai = getOpenAIClient();
    if (!openai) {
      const timingMs = Date.now() - startMs;
      const fallback = renderFallbackAnswer(selectedClaims, sourcesById);
      request.log.warn(
        { ...effectiveLogContext, timingMs, result: "fallback" },
        "Missing OPENAI_API_KEY; returning evidence-only response."
      );
      reply.code(200).send({
        answer: fallback.answer,
        citations: fallback.citations,
        sources: fallback.citations.map((source) => source.url)
      });
      return;
    }

    const assistantIdentity = agent
      ? `${agent.label} category management advisor (${portfolioLabel(agent.portfolio)})`
      : `${portfolioLabel(portfolio)} category management advisor`;
    const agentConfig = agent
      ? { ...agent, maxArticlesToConsider: agent.maxArticlesToConsider ?? agent.articlesPerRun ?? 3 }
      : undefined;
    const agentPrompt = agentConfig ? buildAgentSystemPrompt(agentConfig as any, region) : assistantIdentity;
    const framework = getAgentFramework(agentConfig?.id ?? portfolio);
    const systemMessage = [
      "You are ProofOfConceptStudio Chat Analyst.",
      agentPrompt,
      "Be concise, factual, and do not invent provenance.",
      "Answer ONLY using the provided evidence excerpts; if evidence is missing, say so explicitly.",
      "Cite sources with [sourceId] tokens that map to the allowed sources list.",
      "Use the interpretation framework to explain why it matters and recommend actions:",
      `Focus areas: ${framework.focusAreas.join(", ") || "N/A"}.`,
      `Market drivers: ${framework.marketDrivers.join(", ") || "N/A"}.`,
      `Procurement considerations: ${framework.procurementConsiderations.join(", ") || "N/A"}.`,
      `You are ${assistantIdentity} focused on negotiation tactics, supplier strategy, and sourcing risk controls.`,
      "Use Markdown with bullet points and short paragraphs.",
      "Do not emit HTML."
    ].join(" ");
    const allowedSourceList = normalizedSources.length
      ? normalizedSources.map((source) => `${source.sourceId}: ${source.url}`).join("\n")
      : "None";
    const promptSections = [
      `Allowed sources (sourceId -> URL):\n${allowedSourceList}`,
      "Evidence-backed claims and excerpts:",
      context || "No evidence available."
    ];
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

    const requestChatCompletionWithFallbacks = async (models: string[]) => {
      let lastError: unknown;
      for (const model of models) {
        try {
          return { response: await requestChatCompletion(model), model };
        } catch (err) {
          lastError = err;
          const status = (err as { status?: number })?.status;
          const code = (err as { code?: string })?.code;
          const isModelError = status === 404 || status === 403 || code === "model_not_found";
          if (!isModelError) {
            throw err;
          }
        }
      }
      throw lastError;
    };

    try {
      const { response, model } = await requestChatCompletionWithFallbacks(getModelFallbacks());
      const rawAnswer = response.choices?.[0]?.message?.content ?? "";
      const foundSourceIds = extractSourceIds(rawAnswer);
      const citations = foundSourceIds
        .map((id) => sourcesById.get(id))
        .filter((item): item is BriefSource => Boolean(item));
      const answer = replaceSourceIdsWithLinks(rawAnswer, sourcesById);

      const timingMs = Date.now() - startMs;
      const debug = getDebugChatLogging();
      request.log.info(
        {
          ...effectiveLogContext,
          timingMs,
          openaiRequestId: response.id,
          result: "ok",
          model,
          questionPreview: debug ? effectiveQuestion.slice(0, 300) : undefined,
          citationsCount: citations.length
        },
        "Chat response generated"
      );
      return { answer, citations, sources: citations.map((source) => source.url) };
    } catch (err) {
      const timingMs = Date.now() - startMs;
      const errorMessage = (err as Error)?.message ?? "Unknown error";
      const status = (err as { status?: number })?.status;
      const code = (err as { code?: string })?.code;
      const isAuthError = status === 401 || status === 403;
      const isNotFound = status === 404 || code === "model_not_found";
      request.log.error(
        { err, status, code, ...effectiveLogContext, timingMs, result: "error" },
        "AI call failed; rejecting chat request."
      );
      if (getDebugChatLogging()) {
        request.log.info({ ...effectiveLogContext, timingMs, result: "error", errorMessage }, "Chat error detail");
      }
      const fallback = renderFallbackAnswer(selectedClaims, sourcesById);
      if (fallback.answer) {
        reply.code(200).send({
          answer: fallback.answer,
          citations: fallback.citations,
          sources: fallback.citations.map((source) => source.url),
          error: isAuthError || isNotFound ? "AI unavailable; returned evidence-only response." : "AI error; returned evidence-only response."
        });
        return;
      }
      if (isAuthError || isNotFound) {
        reply.code(503).send({ error: "AI is temporarily unavailable due to configuration." });
        return;
      }
      reply.code(500).send({ error: "AI response failed to generate." });
      return;
    }
  });
};

export default chatRoutes;
