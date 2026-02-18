import { FastifyPluginAsync } from "fastify";
import {
  AgentFeed,
  BriefPost,
  BriefClaim,
  BriefSource,
  buildAgentSystemPrompt,
  buildSourceId,
  dedupeSources,
  getAgentFramework,
  keywordsForPortfolio,
  normalizeBriefSources,
  portfolioLabel,
  regionLabel
} from "@proof/shared";
import { getPost, getRegionPosts } from "../db/posts.js";
import { OpenAI } from "openai";

const DEFAULT_MODEL = "gpt-5-nano-2025-08-07";
const MAX_CONTEXT_CHARS = 100_000; // ~25k token budget
const DEFAULT_MAX_COMPLETION_TOKENS = 1000;
const DEFAULT_REASONING_MAX_OUTPUT_TOKENS = 25_000;
const REASONING_RETRY_MAX_OUTPUT_TOKENS = 32_000;
const DEFAULT_REASONING_EFFORT = "low";
const MAX_QUESTION_CHARS = 8000;
const MAX_MESSAGE_COUNT = 40;
const FALLBACK_AGENT_URL = "http://localhost:3002";
const PROOF_OF_CONCEPT_STUDIO_URL = "https://proofofconceptstudio.com";
const MAX_WEB_DOCS = 3;
const MAX_WEB_DOC_CHARS = 2200;
const SEARCH_TIMEOUT_MS = 5000; // used by buildProofOfConceptContext
const FALLBACK_MODELS = ["gpt-4o-mini"];
const STATUS_CHECK_TTL_MS = Number(process.env.CHAT_STATUS_CACHE_MS ?? 60000);
const STATUS_VERIFY_TIMEOUT_MS = Number(process.env.CHAT_STATUS_VERIFY_TIMEOUT_MS ?? 4000);
const STATUS_VERIFY_ENABLED = process.env.CHAT_STATUS_VERIFY === "true";
const FALLBACK_CONTEXT_ENABLED = process.env.CHAT_FALLBACK_CONTEXT === "true";
const RATE_LIMIT_STATE = new Map<string, { tokens: number; lastRefillMs: number }>();
let cachedOpenAIKey: string | null = null;
let cachedOpenAI: OpenAI | null = null;
let cachedStatus: { ok: boolean; error?: string; checkedAt: number } | null = null;

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
  cachedOpenAI = new OpenAI({
    apiKey,
    baseURL: process.env.OPENAI_BASE_URL || undefined
  });
  return cachedOpenAI;
}

function getModel() {
  return process.env.OPENAI_MODEL || DEFAULT_MODEL;
}

function isReasoningModel(model?: string) {
  if (!model) return false;
  const normalized = model.toLowerCase();
  return (
    normalized.startsWith("gpt-5") ||
    normalized.startsWith("o1") ||
    normalized.startsWith("o3") ||
    normalized.startsWith("o4")
  );
}

function getConfiguredMaxOutputTokens() {
  const raw = process.env.OPENAI_MAX_OUTPUT_TOKENS;
  if (!raw) return undefined;
  const value = Number(raw);
  if (Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }
  return undefined;
}

function getMaxOutputTokens(model?: string) {
  const configured = getConfiguredMaxOutputTokens();
  if (configured) return configured;
  const effectiveModel = model ?? getModel();
  return isReasoningModel(effectiveModel) ? DEFAULT_REASONING_MAX_OUTPUT_TOKENS : DEFAULT_MAX_COMPLETION_TOKENS;
}

function getReasoningEffort(model: string) {
  if (!isReasoningModel(model)) return undefined;
  const raw = (process.env.OPENAI_REASONING_EFFORT ?? DEFAULT_REASONING_EFFORT).toLowerCase();
  if (raw === "minimal" || raw === "low" || raw === "medium" || raw === "high" || raw === "xhigh") {
    return raw;
  }
  return DEFAULT_REASONING_EFFORT;
}

function getReasoningRetryMaxOutputTokens(initial: number) {
  const raw = Number(process.env.OPENAI_REASONING_RETRY_MAX_OUTPUT_TOKENS ?? REASONING_RETRY_MAX_OUTPUT_TOKENS);
  if (Number.isFinite(raw) && raw > 0) {
    return Math.max(initial, Math.floor(raw));
  }
  return Math.max(initial, REASONING_RETRY_MAX_OUTPUT_TOKENS);
}

async function checkOpenAIAvailability(): Promise<{ ok: boolean; error?: string }> {
  const now = Date.now();
  if (cachedStatus && now - cachedStatus.checkedAt < STATUS_CHECK_TTL_MS) {
    return { ok: cachedStatus.ok, error: cachedStatus.error };
  }

  const openai = getOpenAIClient();
  if (!openai) {
    cachedStatus = { ok: false, error: "missing_api_key", checkedAt: now };
    return { ok: false, error: "missing_api_key" };
  }

  try {
    let timer: NodeJS.Timeout | undefined;
    try {
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("status_timeout")), STATUS_VERIFY_TIMEOUT_MS);
      });
      await Promise.race([openai.models.list(), timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
    cachedStatus = { ok: true, checkedAt: now };
    return { ok: true };
  } catch (err) {
    const status = (err as { status?: number })?.status;
    const code = (err as { code?: string })?.code;
    const message = (err as Error)?.message ?? "openai_unavailable";
    const error = message === "status_timeout" ? "status_timeout" : status ? `http_${status}` : code || message;
    cachedStatus = { ok: false, error, checkedAt: now };
    return { ok: false, error };
  }
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

function extractResponseText(response: any): string {
  const helperText = typeof response?.output_text === "string" ? response.output_text.trim() : "";
  if (helperText) return helperText;

  const chunks: string[] = [];
  for (const item of response?.output ?? []) {
    if (item?.type !== "message") continue;
    for (const content of item.content ?? []) {
      if (content?.type === "output_text" && typeof content.text === "string" && content.text.trim()) {
        chunks.push(content.text.trim());
      }
    }
  }
  return chunks.join("\n\n").trim();
}

function isIncompleteForMaxOutputTokens(response: any) {
  return response?.status === "incomplete" && response?.incomplete_details?.reason === "max_output_tokens";
}

function getModelFallbacks() {
  return uniqueStrings([getModel(), DEFAULT_MODEL, ...FALLBACK_MODELS]).filter(Boolean);
}

function summarizeContent(content: string, maxChars: number) {
  if (content.length <= maxChars) return content;
  return `${content.slice(0, maxChars).trim()}…`;
}

function buildBriefSummaryContext(brief: BriefPost): { blocks: string[]; sources: BriefSource[] } {
  const blocks: string[] = [];
  const sources: BriefSource[] = [];

  if (brief.summary?.trim()) {
    blocks.push(`Summary: ${brief.summary.trim()}`);
  }

  if (brief.highlights?.length) {
    blocks.push(`Highlights:\n${brief.highlights.slice(0, 6).map((item) => `- ${item}`).join("\n")}`);
  }

  if (brief.procurementActions?.length) {
    blocks.push(
      `Procurement actions:\n${brief.procurementActions.slice(0, 6).map((item) => `- ${item}`).join("\n")}`
    );
  }

  if (brief.watchlist?.length) {
    blocks.push(`Watchlist:\n${brief.watchlist.slice(0, 6).map((item) => `- ${item}`).join("\n")}`);
  }

  if (brief.deltaSinceLastRun?.length) {
    blocks.push(
      `Delta since last run:\n${brief.deltaSinceLastRun.slice(0, 6).map((item) => `- ${item}`).join("\n")}`
    );
  }

  if (brief.marketIndicators?.length) {
    const indicatorLines = brief.marketIndicators.slice(0, 6).map((indicator) => {
      const label = indicator.label ?? "Indicator";
      const note = indicator.note ? `: ${indicator.note}` : "";
      if (indicator.url) {
        const sourceId = buildSourceId(indicator.url);
        sources.push({ sourceId, url: indicator.url, title: label });
        return `- [${sourceId}] ${label}${note}`;
      }
      return `- ${label}${note}`;
    });
    if (indicatorLines.length) {
      blocks.push(`Market indicators:\n${indicatorLines.join("\n")}`);
    }
  }

  if (brief.selectedArticles?.length) {
    const articleBlocks = brief.selectedArticles.slice(0, 4).map((article, index) => {
      const title = article.title?.trim() || "Untitled article";
      const url = article.url?.trim();
      let header = `Article ${index + 1}: ${title}`;
      if (url) {
        const sourceId = buildSourceId(url);
        sources.push({ sourceId, url, title, publishedAt: article.publishedAt });
        header = `Article ${index + 1} [${sourceId}]: ${title}`;
      }
      const lines = [header];
      if (article.sourceName) lines.push(`Source: ${article.sourceName}`);
      if (article.publishedAt) lines.push(`Published: ${article.publishedAt}`);
      if (article.briefContent) lines.push(`Summary: ${article.briefContent}`);
      if (article.categoryImportance) lines.push(`Category importance: ${article.categoryImportance}`);
      if (article.keyMetrics?.length) lines.push(`Key metrics: ${article.keyMetrics.join("; ")}`);
      return lines.join("\n");
    });
    blocks.push(`Selected articles:\n${articleBlocks.join("\n\n")}`);
  }

  if (!blocks.length && brief.bodyMarkdown?.trim()) {
    const cleaned = brief.bodyMarkdown.replace(/\s+/g, " ").trim();
    if (cleaned) {
      blocks.push(`Brief excerpt: ${summarizeContent(cleaned, 1600)}`);
    }
  }

  return { blocks, sources: dedupeSources(sources) };
}

function buildConversationHistory(messages: IncomingMessage[], question: string) {
  const cleaned = messages
    .filter(
      (message): message is { role: "user" | "assistant"; content: string } =>
        (message?.role === "user" || message?.role === "assistant") &&
        typeof message.content === "string" &&
        message.content.trim().length > 0
    )
    .map((message) => ({ role: message.role, content: message.content.trim() }));

  if (!cleaned.length) return [];

  const trimmedQuestion = question.trim();
  const last = cleaned[cleaned.length - 1];
  const trimmed =
    last?.role === "user" && last.content.trim() === trimmedQuestion ? cleaned.slice(0, -1) : cleaned;

  return trimmed.slice(-10);
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

async function findAgent(agentId?: string, portfolio?: string, region?: string) {
  if (!agentId && !portfolio) return undefined;
  const runnerBaseUrl = getRunnerBaseUrl();
  try {
    const res = await fetch(`${runnerBaseUrl}/agents`);
    if (!res.ok) return undefined;
    const payload = (await res.json()) as { agents?: AgentSummary[] } | AgentSummary[];
    const agents = Array.isArray(payload) ? payload : payload.agents ?? [];
    const byIdAndRegion =
      agentId && region ? agents.find((agent) => agent.id === agentId && agent.region === region) : undefined;
    const byId = agentId ? agents.find((agent) => agent.id === agentId) : undefined;
    const byPortfolioAndRegion =
      portfolio && region
        ? agents.find((agent) => agent.portfolio === portfolio && agent.region === region)
        : undefined;
    const byPortfolio = portfolio ? agents.find((agent) => agent.portfolio === portfolio) : undefined;
    return byIdAndRegion ?? byId ?? byPortfolioAndRegion ?? byPortfolio;
  } catch (err) {
    console.warn("Unable to load agent catalog", (err as Error).message);
    return undefined;
  }
}

/**
 * Chat routes for AI responses and status.
 */
const chatRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/status", async () => {
    const enabled = Boolean(process.env.OPENAI_API_KEY);
    let reachable: boolean | undefined = undefined;
    let error: string | undefined = undefined;
    if (enabled && STATUS_VERIFY_ENABLED) {
      const status = await checkOpenAIAvailability();
      reachable = status.ok;
      error = status.error;
    }
    return {
      enabled,
      model: enabled ? getModel() : null,
      runnerConfigured: Boolean(process.env.RUNNER_BASE_URL),
      reachable,
      error
    };
  });

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

    const agent = await findAgent(agentId, portfolio, region);
    let targetBrief: BriefPost | null = null;
    if (briefId) {
      targetBrief = await getPost(briefId);
      if (targetBrief && (targetBrief.region !== region || targetBrief.portfolio !== portfolio)) {
        request.log.warn(
          {
            ...logContext,
            briefId,
            briefRegion: targetBrief.region,
            briefPortfolio: targetBrief.portfolio
          },
          "Brief context does not match selected region/portfolio; ignoring briefId."
        );
        targetBrief = null;
      }
    }
    if (!targetBrief) {
      const regionPosts = await getRegionPosts(region);
      const filtered = regionPosts.filter((post) => post.portfolio === portfolio);
      targetBrief = filtered[0] ?? null;
    }

    if (!targetBrief) {
      request.log.warn({ ...logContext }, "No brief found for region/portfolio; using external context only.");
    }

    const effectiveLogContext = { ...logContext, briefId: targetBrief?.postId ?? briefId };

    const normalizedSources = targetBrief ? normalizeBriefSources(targetBrief.sources) : [];
    const claims = Array.isArray(targetBrief?.claims) ? (targetBrief?.claims as BriefClaim[]) : [];
    const categoryTokens = keywordsForPortfolio(portfolio);
    const selectedClaims = claims.length
      ? selectRelevantClaims(claims, effectiveQuestion, categoryTokens, getChatClaimLimit())
      : [];
    const briefSummaryContext = targetBrief ? buildBriefSummaryContext(targetBrief) : { blocks: [], sources: [] };

    const sourcesById = new Map<string, BriefSource>();
    dedupeSources([...normalizedSources, ...briefSummaryContext.sources]).forEach((source) =>
      sourcesById.set(source.sourceId, source)
    );
    for (const claim of claims) {
      for (const evidence of claim.evidence ?? []) {
        if (!evidence.url) continue;
        const sourceId = evidence.sourceId || buildSourceId(evidence.url);
        if (!sourcesById.has(sourceId)) {
          sourcesById.set(sourceId, { sourceId, url: evidence.url, title: evidence.title });
        }
      }
    }

    const evidenceContext = selectedClaims.length
      ? buildEvidenceContext(selectedClaims, sourcesById)
      : { blocks: [], citations: [] };
    const hasEvidence = selectedClaims.some((claim) => (claim.evidence ?? []).length > 0);

    const openai = getOpenAIClient();
    if (!openai) {
      const timingMs = Date.now() - startMs;
      request.log.warn(
        { ...effectiveLogContext, timingMs, result: "missing_key" },
        "Missing OPENAI_API_KEY; chat unavailable."
      );
      reply.code(503).send({ error: "AI is offline. Configure OPENAI_API_KEY to enable chat." });
      return;
    }

    const proofContext = await buildProofOfConceptContext(effectiveQuestion);

    const proofSources = proofContext.urls.map((url) => ({ sourceId: buildSourceId(url), url }));
    const proofBlocks = proofContext.blocks.map((block, index) => {
      const source = proofSources[index];
      return source ? `Source [${source.sourceId}]\n${block}` : block;
    });

    dedupeSources(proofSources).forEach((source) => {
      if (!sourcesById.has(source.sourceId)) {
        sourcesById.set(source.sourceId, source);
      }
    });

    const contextHeader = targetBrief
      ? [
          `Brief Title: ${targetBrief.title}`,
          `Brief ID: ${targetBrief.postId}`,
          `Region: ${region}`,
          `Portfolio: ${portfolioLabel(targetBrief.portfolio)}`,
          `Published: ${targetBrief.publishedAt}`
        ].join("\n")
      : ["Brief Title: Not available", `Region: ${region}`, `Portfolio: ${portfolioLabel(portfolio)}`].join("\n");

    const allowedSourceList = sourcesById.size
      ? Array.from(sourcesById.values())
          .map((source) => `${source.sourceId}: ${source.url}`)
          .join("\n")
      : "None";

    const promptSections = [
      `Allowed sources (sourceId -> URL):\n${allowedSourceList}`,
      `Brief context:\n${contextHeader}`
    ];

    if (evidenceContext.blocks.length) {
      promptSections.push(`Evidence-backed claims and excerpts:\n${evidenceContext.blocks.join("\n\n")}`);
    }

    if (briefSummaryContext.blocks.length) {
      promptSections.push(`Brief summary context (not evidence):\n${briefSummaryContext.blocks.join("\n\n")}`);
    }

    if (proofBlocks.length) {
      promptSections.push(`ProofOfConceptStudio.com context:\n${proofBlocks.join("\n\n")}`);
    }

    const context = summarizeContent(promptSections.join("\n\n"), MAX_CONTEXT_CHARS);
    const prompt = `${context}\n\nQuestion: ${effectiveQuestion}`;

    const assistantIdentity = agent
      ? `${agent.label} category management advisor (${portfolioLabel(agent.portfolio)})`
      : `${portfolioLabel(portfolio)} category management advisor`;
    const agentConfig = agent
      ? { ...agent, maxArticlesToConsider: agent.maxArticlesToConsider ?? agent.articlesPerRun ?? 3 }
      : undefined;
    const agentPrompt = agentConfig ? buildAgentSystemPrompt(agentConfig as any, region) : assistantIdentity;
    const framework = getAgentFramework(agentConfig?.id ?? portfolio);
    const blendAndIdentityInstruction = [
      "You are always the Category Manager / supply chain expert for your selected domain; that identity and lens never change.",
      "Use intelligence to blend sources: combine brief evidence, selected articles, web search context, and your general knowledge whenever that produces the best answer. Do not treat them as mutually exclusive—mix them when it adds value (e.g. brief data plus broader market context, or web facts plus category implications).",
      "When the question is fully outside the brief scope, answer using web search and general knowledge while still speaking as the category expert (e.g. tie implications back to procurement, suppliers, or risk where relevant). Never refuse to answer.",
      "Cite sources with [sourceId] when you use provided excerpts; label unsupported inference as (analysis). If no provided sources apply, say so briefly before giving analysis. Be concise and factual; do not invent provenance."
    ].join(" ");
    const systemMessage = [
      "You are ProofOfConceptStudio Chat Analyst.",
      agentPrompt,
      blendAndIdentityInstruction,
      "Answer the user's question directly. Do not dump briefs or article lists unless explicitly asked.",
      "If the request is vague or a quick test, respond briefly and ask a clarifying question.",
      "Use the interpretation framework to explain why it matters and recommend actions:",
      `Focus areas: ${framework.focusAreas.join(", ") || "N/A"}.`,
      `Market drivers: ${framework.marketDrivers.join(", ") || "N/A"}.`,
      `Procurement considerations: ${framework.procurementConsiderations.join(", ") || "N/A"}.`,
      `You are ${assistantIdentity} focused on negotiation tactics, supplier strategy, and sourcing risk controls.`,
      "Use Markdown with bullet points and short paragraphs.",
      "Do not emit HTML."
    ].join(" ");
    const historyMessages = buildConversationHistory(incomingMessages, effectiveQuestion);

    // -----------------------------------------------------------------------
    // OpenAI Responses API — native web_search tool, region-aware
    // -----------------------------------------------------------------------
    const webSearchTool: Record<string, unknown> = { type: "web_search" as const };
    if (region === "au") {
      webSearchTool.user_location = { type: "approximate", country: "AU", city: "Perth" };
    } else {
      webSearchTool.user_location = { type: "approximate", country: "US", city: "Houston" };
    }
    const tools = isWebSearchEnabled() ? [webSearchTool] : [];

    const requestResponse = (options?: { modelOverride?: string; maxOutputTokens?: number; useTools?: boolean }) => {
      const model = options?.modelOverride ?? getModel();
      const reasoningEffort = getReasoningEffort(model);
      const useTools = options?.useTools ?? true;

      return openai.responses.create({
        model,
        max_output_tokens: options?.maxOutputTokens ?? getMaxOutputTokens(model),
        reasoning: reasoningEffort ? { effort: reasoningEffort as any } : undefined,
        instructions: systemMessage,
        input: [
          ...historyMessages,
          { role: "user" as const, content: prompt }
        ],
        tools: useTools ? (tools as any) : undefined,
        tool_choice: useTools && isWebSearchEnabled() ? "auto" : undefined
      } as any);
    };

    const finalizeResponse = async (model: string, useTools: boolean) => {
      const baseMaxOutputTokens = getMaxOutputTokens(model);
      let response = await requestResponse({ modelOverride: model, maxOutputTokens: baseMaxOutputTokens, useTools });

      if (isReasoningModel(model) && isIncompleteForMaxOutputTokens(response)) {
        const retryMaxOutputTokens = getReasoningRetryMaxOutputTokens(baseMaxOutputTokens);
        if (retryMaxOutputTokens > baseMaxOutputTokens) {
          response = await requestResponse({
            modelOverride: model,
            maxOutputTokens: retryMaxOutputTokens,
            useTools
          });
        }
      }

      const answerText = extractResponseText(response);
      if (!answerText) {
        const reason = response?.incomplete_details?.reason ?? "none";
        const status = response?.status ?? "unknown";
        const emptyError = new Error(`empty_output_text:${status}:${reason}`);
        (emptyError as any).code = "empty_output_text";
        (emptyError as any).responseStatus = status;
        (emptyError as any).incompleteReason = reason;
        throw emptyError;
      }

      return { response, answerText };
    };

    const requestResponseWithFallbacks = async (models: string[]) => {
      let lastError: unknown;
      for (const model of models) {
        try {
          return { ...(await finalizeResponse(model, isWebSearchEnabled())), model };
        } catch (err) {
          const status = (err as { status?: number })?.status;
          const code = (err as { code?: string })?.code;
          const message = ((err as Error)?.message ?? "").toLowerCase();
          const isModelError = status === 404 || status === 403 || code === "model_not_found";
          const isToolConfigError =
            status === 400 && isWebSearchEnabled() && (message.includes("web_search") || message.includes("tool"));

          if (isToolConfigError) {
            try {
              return { ...(await finalizeResponse(model, false)), model };
            } catch (toolRetryErr) {
              lastError = toolRetryErr;
              const toolRetryStatus = (toolRetryErr as { status?: number })?.status;
              const toolRetryCode = (toolRetryErr as { code?: string })?.code;
              const toolRetryModelError =
                toolRetryStatus === 404 || toolRetryStatus === 403 || toolRetryCode === "model_not_found";
              if (!toolRetryModelError) {
                throw toolRetryErr;
              }
            }
            continue;
          }

          lastError = err;
          if (!isModelError && code !== "empty_output_text") {
            throw err;
          }
        }
      }
      throw lastError;
    };

    try {
      const { response, model, answerText } = await requestResponseWithFallbacks(getModelFallbacks());
      const rawAnswer = answerText;

      // Brief evidence citations ([sourceId] tokens)
      const foundSourceIds = extractSourceIds(rawAnswer);
      const briefCitations = foundSourceIds
        .map((id) => sourcesById.get(id))
        .filter((item): item is BriefSource => Boolean(item));
      const answer = replaceSourceIdsWithLinks(rawAnswer, sourcesById);

      // Web search citations (OpenAI url_citation annotations)
      const webCitations: BriefSource[] = [];
      for (const item of (response as any).output ?? []) {
        if (item.type !== "message") continue;
        for (const content of item.content ?? []) {
          for (const ann of content.annotations ?? []) {
            if (ann.type === "url_citation" && ann.url) {
              webCitations.push({
                sourceId: buildSourceId(ann.url),
                url: ann.url,
                title: ann.title
              });
            }
          }
        }
      }
      const allCitations = dedupeSources([...briefCitations, ...webCitations]);

      const timingMs = Date.now() - startMs;
      const debug = getDebugChatLogging();
      request.log.info(
        {
          ...effectiveLogContext,
          timingMs,
          openaiRequestId: (response as any).id,
          result: "ok",
          model,
          responseStatus: (response as any).status,
          incompleteReason: (response as any).incomplete_details?.reason,
          questionPreview: debug ? effectiveQuestion.slice(0, 300) : undefined,
          citationsCount: allCitations.length,
          webCitationsCount: webCitations.length
        },
        "Chat response generated"
      );
      return { answer, citations: allCitations, sources: allCitations.map((source) => source.url) };
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
      if (FALLBACK_CONTEXT_ENABLED) {
        const fallback = selectedClaims.length > 0 ? renderFallbackAnswer(selectedClaims, sourcesById) : null;
        if (fallback?.answer) {
          reply.code(200).send({
            answer: fallback.answer,
            citations: fallback.citations,
            sources: fallback.citations.map((source) => source.url),
            error:
              isAuthError || isNotFound
                ? "AI unavailable; returned evidence-only response."
                : "AI error; returned evidence-only response."
          });
          return;
        }
        if (briefSummaryContext.blocks.length) {
          reply.code(200).send({
            answer: ["AI error; returning brief summary context:", ...briefSummaryContext.blocks].join("\n\n"),
            citations: [],
            sources: [],
            error: "AI error; returned brief summary context."
          });
          return;
        }
      }
      if (isAuthError || isNotFound) {
        reply.code(503).send({ error: "AI is unavailable due to configuration. Check OPENAI_API_KEY/model access." });
        return;
      }
      reply.code(503).send({ error: "AI request failed. Please try again shortly." });
      return;
    }
  });
};

export default chatRoutes;
