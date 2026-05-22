import {
  BriefClaim,
  BriefPost,
  BriefSource,
  buildAgentSystemPrompt,
  buildSourceId,
  dedupeSources,
  findAgentSummary,
  getAgentFramework,
  keywordsForPortfolio,
  listAgentSummaries,
  normalizeBriefSources,
  portfolioLabel,
  type AgentCatalogSummary
} from "@proof/shared";
import { OpenAI } from "openai";
import { initializeSecrets } from "../secrets";
import { getLatestPortfolioPost, getPost } from "./posts";

const DEFAULT_MODEL = "gpt-5-nano-2025-08-07";
const MAX_QUESTION_CHARS = 8000;
const MAX_MESSAGE_COUNT = 40;
const DEFAULT_MAX_CONTEXT_CHARS = 40_000;
const DEFAULT_MAX_COMPLETION_TOKENS = 1000;
const DEFAULT_REASONING_MAX_OUTPUT_TOKENS = 25_000;
const REASONING_RETRY_MAX_OUTPUT_TOKENS = 32_000;
const STATUS_CHECK_TTL_MS = Number(process.env.CHAT_STATUS_CACHE_MS ?? 60000);
const STATUS_VERIFY_TIMEOUT_MS = Number(process.env.CHAT_STATUS_VERIFY_TIMEOUT_MS ?? 4000);
const STATUS_VERIFY_ENABLED = process.env.CHAT_STATUS_VERIFY === "true";
const FALLBACK_CONTEXT_ENABLED = process.env.CHAT_FALLBACK_CONTEXT === "true";
const PROOF_OF_CONCEPT_STUDIO_URL = "https://proofofconceptstudio.com";
const MAX_WEB_DOCS = 3;
const MAX_WEB_DOC_CHARS = 2200;
const DEFAULT_PROOF_CONTEXT_TIMEOUT_MS = 1500;
const DEFAULT_PROOF_CONTEXT_TTL_MS = 10 * 60 * 1000;
const FALLBACK_MODELS = ["gpt-4o-mini"];
const RATE_LIMIT_STATE = new Map<string, { tokens: number; lastRefillMs: number }>();
const STOPWORDS = new Set([
  "the","and","for","with","that","this","from","into","over","under","about","while","when","where","which","what",
  "will","would","could","should","a","an","of","to","in","on","by","at","is","are","was","were","be","been","it",
  "as","or","if","than","then","but","so","we","they","their","our","your","its","these","those"
]);

let cachedOpenAIKey: string | null = null;
let cachedOpenAI: OpenAI | null = null;
let cachedStatus: { ok: boolean; error?: string; checkedAt: number } | null = null;
let envInitPromise: Promise<void> | null = null;
let proofSitemapCache: { urls: string[]; checkedAtMs: number } | null = null;
const PROOF_PAGE_CACHE = new Map<string, { block: string; source: BriefSource; checkedAtMs: number }>();

type IncomingMessage = {
  role?: string;
  content?: string;
};

type WebSearchMode = "auto" | "always" | "off";

export type ChatStatus = {
  enabled: boolean;
  model: string | null;
  runnerConfigured: boolean;
  reachable?: boolean;
  error?: string;
};

export type ChatRequestInput = {
  question?: string;
  region?: string;
  portfolio?: string;
  agentId?: string;
  messages?: IncomingMessage[];
  conversationId?: string;
  briefId?: string;
  clientIp?: string;
};

export class ChatRouteError extends Error {
  status: number;
  payload: Record<string, unknown>;

  constructor(status: number, payload: Record<string, unknown>) {
    super(String(payload.error ?? "chat_request_failed"));
    this.status = status;
    this.payload = payload;
  }
}

async function ensureChatEnv() {
  if (!envInitPromise) {
    envInitPromise = initializeSecrets().catch((err) => {
      envInitPromise = null;
      throw err;
    });
  }
  await envInitPromise;
}

async function getOpenAIClient(): Promise<OpenAI | null> {
  await ensureChatEnv();
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

function positiveEnvNumber(name: string, fallback: number): number {
  const value = Number(process.env[name] ?? "");
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function getMaxContextChars() {
  return positiveEnvNumber("CHAT_MAX_CONTEXT_CHARS", DEFAULT_MAX_CONTEXT_CHARS);
}

function getProofContextTtlMs() {
  return positiveEnvNumber("CHAT_PROOF_CONTEXT_TTL_MS", DEFAULT_PROOF_CONTEXT_TTL_MS);
}

function getProofContextTimeoutMs() {
  return positiveEnvNumber("CHAT_PROOF_CONTEXT_TIMEOUT_MS", DEFAULT_PROOF_CONTEXT_TIMEOUT_MS);
}

function isReasoningModel(model?: string) {
  if (!model) return false;
  const normalized = model.toLowerCase();
  return normalized.startsWith("gpt-5") || normalized.startsWith("o1") || normalized.startsWith("o3") || normalized.startsWith("o4");
}

function getMaxOutputTokens(model?: string) {
  const configured = Number(process.env.OPENAI_MAX_OUTPUT_TOKENS ?? "");
  if (Number.isFinite(configured) && configured > 0) {
    return Math.floor(configured);
  }
  const effectiveModel = model ?? getModel();
  return isReasoningModel(effectiveModel) ? DEFAULT_REASONING_MAX_OUTPUT_TOKENS : DEFAULT_MAX_COMPLETION_TOKENS;
}

function getReasoningEffort(model: string) {
  if (!isReasoningModel(model)) return undefined;
  const raw = (process.env.OPENAI_REASONING_EFFORT ?? "low").toLowerCase();
  return raw === "minimal" || raw === "low" || raw === "medium" || raw === "high" || raw === "xhigh"
    ? raw
    : "low";
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

  const openai = await getOpenAIClient();
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

function getWebSearchMode(): WebSearchMode {
  if (process.env.WEB_SEARCH_ENABLED === "false") return "off";
  const raw = (process.env.CHAT_WEB_SEARCH_MODE ?? "auto").toLowerCase();
  if (raw === "always" || raw === "off") return raw;
  return "auto";
}

function shouldUseWebSearch(question: string, hasProvidedContext: boolean): boolean {
  const mode = getWebSearchMode();
  if (mode === "off") return false;
  if (mode === "always") return true;
  if (!hasProvidedContext) return true;
  return /\b(today|current|latest|recent|news|web|internet|external|outside|price|prices|quote|stock|cite|source)\b/i.test(question);
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
  if (process.env.CHAT_RATE_LIMIT_DISABLED === "true") {
    return true;
  }
  const now = Date.now();
  const { rpm, burst } = getRateLimitConfig();
  const state = RATE_LIMIT_STATE.get(clientIp) ?? { tokens: burst, lastRefillMs: now };
  const refill = ((now - state.lastRefillMs) / 60000) * rpm;
  state.tokens = Math.min(burst, state.tokens + refill);
  state.lastRefillMs = now;

  if (state.tokens < 1) {
    RATE_LIMIT_STATE.set(clientIp, state);
    return false;
  }

  state.tokens -= 1;
  RATE_LIMIT_STATE.set(clientIp, state);
  return true;
}

function tokenize(text: string): string[] {
  const tokens = (text.toLowerCase().match(/[a-z0-9]+/g) ?? []) as string[];
  return tokens.filter(
    (token) => token.length > 2 && !STOPWORDS.has(token)
  );
}

function summarizeContent(content: string, maxChars: number) {
  if (content.length <= maxChars) return content;
  return `${content.slice(0, maxChars).trim()}...`;
}

function keywordTokens(question: string) {
  const tokens = (question.toLowerCase().match(/[a-z0-9]+/g) ?? []) as string[];
  return [...new Set(tokens.filter((token) => token.length > 3))].slice(0, 8);
}

function extractUrlsFromSitemap(xml: string) {
  return Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/gi)).map((match) => match[1].trim());
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
  return match ? match[1].trim() : "ProofOfConceptStudio.com";
}

async function fetchWithTimeout(url: string, timeoutMs = getProofContextTimeoutMs()) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function isFreshCacheEntry(checkedAtMs: number) {
  return Date.now() - checkedAtMs < getProofContextTtlMs();
}

async function loadProofSitemapUrls(): Promise<string[]> {
  const sitemapCandidates = [
    `${PROOF_OF_CONCEPT_STUDIO_URL}/sitemap.xml`,
    `${PROOF_OF_CONCEPT_STUDIO_URL}/sitemap_index.xml`,
    `${PROOF_OF_CONCEPT_STUDIO_URL}/wp-sitemap.xml`
  ];

  if (proofSitemapCache && isFreshCacheEntry(proofSitemapCache.checkedAtMs)) {
    return proofSitemapCache.urls;
  }

  const attempts = await Promise.all(
    sitemapCandidates.map(async (sitemapUrl) => {
      try {
        const res = await fetchWithTimeout(sitemapUrl);
        if (!res.ok) return [];
        return extractUrlsFromSitemap(await res.text());
      } catch {
        return [];
      }
    })
  );
  const urls = attempts.find((items) => items.length > 0) ?? [];

  if (urls.length) {
    proofSitemapCache = { urls, checkedAtMs: Date.now() };
    return urls;
  }

  return proofSitemapCache?.urls ?? [];
}

async function loadProofPage(url: string): Promise<{ block: string; source: BriefSource } | null> {
  const cached = PROOF_PAGE_CACHE.get(url);
  if (cached && isFreshCacheEntry(cached.checkedAtMs)) {
    return { block: cached.block, source: cached.source };
  }

  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) return cached ? { block: cached.block, source: cached.source } : null;
    const html = await res.text();
    const sourceId = buildSourceId(url);
    const title = extractTitle(html);
    const block = `Source [${sourceId}]\nTitle: ${title}\nURL: ${url}\nExcerpt: ${summarizeContent(stripHtml(html), MAX_WEB_DOC_CHARS)}`;
    const source = { sourceId, url, title };
    PROOF_PAGE_CACHE.set(url, { block, source, checkedAtMs: Date.now() });
    return { block, source };
  } catch {
    return cached ? { block: cached.block, source: cached.source } : null;
  }
}

async function buildProofContext(question: string) {
  const urls = await loadProofSitemapUrls();

  if (!urls.length) {
    return { blocks: [], sources: [] as BriefSource[] };
  }

  const tokens = keywordTokens(question);
  const topUrls = urls
    .filter((url) => url.includes("proofofconceptstudio.com"))
    .map((url) => ({
      url,
      score: tokens.reduce((acc, token) => (url.toLowerCase().includes(token) ? acc + 1 : acc), 0)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_WEB_DOCS)
    .map((item) => item.url);

  const pages = (await Promise.all(topUrls.map((url) => loadProofPage(url)))).filter(
    (page): page is { block: string; source: BriefSource } => Boolean(page)
  );

  return {
    blocks: pages.map((page) => page.block),
    sources: pages.map((page) => page.source)
  };
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

  const last = cleaned[cleaned.length - 1];
  const trimmed =
    last?.role === "user" && last.content.trim() === question.trim() ? cleaned.slice(0, -1) : cleaned;

  return trimmed.slice(-10);
}

function scoreClaim(claim: BriefClaim, questionTokens: string[], categoryTokens: string[]) {
  const haystack = new Set(tokenize(`${claim.text} ${(claim.evidence ?? []).map((item) => item.excerpt).join(" ")}`));
  const questionHits = questionTokens.filter((token) => haystack.has(token)).length;
  const categoryHits = categoryTokens.filter((token) => haystack.has(token)).length;
  return questionHits * 2 + categoryHits;
}

function selectRelevantClaims(claims: BriefClaim[], question: string, categoryTokens: string[], limit = 6) {
  const questionTokens = tokenize(question);
  const supported = claims.filter((claim) => claim.status === "supported" && claim.evidence?.length);
  const pool = supported.length > 0 ? supported : claims;
  return [...pool]
    .map((claim) => ({ claim, score: scoreClaim(claim, questionTokens, categoryTokens) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.claim);
}

function buildEvidenceContext(claims: BriefClaim[], sourcesById: Map<string, BriefSource>) {
  return claims.map((claim) => {
    const evidenceLines = (claim.evidence ?? []).map((evidence) => {
      const source = sourcesById.get(evidence.sourceId);
      if (source && !sourcesById.has(source.sourceId)) {
        sourcesById.set(source.sourceId, source);
      }
      return `- ${evidence.excerpt} (sourceId: ${evidence.sourceId}, url: ${evidence.url})`;
    });
    return `Claim: ${claim.text}\nEvidence:\n${evidenceLines.join("\n") || "- [No evidence excerpt]"}`;
  });
}

function buildBriefSummaryContext(brief: BriefPost) {
  const blocks: string[] = [];
  const sources: BriefSource[] = [];

  if (brief.summary?.trim()) blocks.push(`Summary: ${brief.summary.trim()}`);
  if (brief.highlights?.length) blocks.push(`Highlights:\n${brief.highlights.slice(0, 6).map((item) => `- ${item}`).join("\n")}`);
  if (brief.procurementActions?.length) {
    blocks.push(`Procurement actions:\n${brief.procurementActions.slice(0, 6).map((item) => `- ${item}`).join("\n")}`);
  }
  if (brief.watchlist?.length) blocks.push(`Watchlist:\n${brief.watchlist.slice(0, 6).map((item) => `- ${item}`).join("\n")}`);
  if (brief.deltaSinceLastRun?.length) {
    blocks.push(`Delta since last run:\n${brief.deltaSinceLastRun.slice(0, 6).map((item) => `- ${item}`).join("\n")}`);
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
    blocks.push(`Brief excerpt: ${summarizeContent(brief.bodyMarkdown.replace(/\s+/g, " ").trim(), 1600)}`);
  }

  return { blocks, sources: dedupeSources(sources) };
}

function buildFallbackResponse(params: {
  brief: BriefPost | null;
  selectedClaims: BriefClaim[];
  briefSummaryContext: { blocks: string[]; sources: BriefSource[] };
  sourcesById: Map<string, BriefSource>;
}) {
  if (params.selectedClaims.length > 0) {
    const citations = dedupeSources(
      params.selectedClaims
        .flatMap((claim) => claim.evidence ?? [])
        .map((evidence) => params.sourcesById.get(evidence.sourceId))
        .filter((item): item is BriefSource => Boolean(item))
    );
    return {
      answer: [
        "AI is unavailable, so here are the strongest brief-backed points:",
        "",
        ...params.selectedClaims.map((claim) => `- ${claim.text}`)
      ].join("\n"),
      citations,
      sources: citations.map((source) => source.url)
    };
  }

  if (params.briefSummaryContext.blocks.length > 0) {
    return {
      answer: [
        "AI is unavailable, so here is the latest brief context for this portfolio:",
        "",
        ...params.briefSummaryContext.blocks
      ].join("\n\n"),
      citations: params.briefSummaryContext.sources,
      sources: params.briefSummaryContext.sources.map((source) => source.url)
    };
  }

  if (params.brief) {
    return {
      answer: `AI is unavailable. The latest brief in context is "${params.brief.title}", but it does not include enough structured evidence to answer this question directly.`,
      citations: [],
      sources: []
    };
  }

  return {
    answer: "AI is unavailable and there is no published brief yet for this region and portfolio.",
    citations: [],
    sources: []
  };
}

function extractSourceIds(text: string) {
  return Array.from(text.matchAll(/\[(src_[a-z0-9]+)\]/gi)).map((match) => match[1].toLowerCase());
}

function replaceSourceIdsWithLinks(text: string, sourcesById: Map<string, BriefSource>) {
  return text.replace(/\[(src_[a-z0-9]+)\]/gi, (match, id) => {
    const source = sourcesById.get(id.toLowerCase());
    return source ? `[Source](${source.url})` : match;
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
  return [...new Set([getModel(), DEFAULT_MODEL, ...FALLBACK_MODELS])].filter(Boolean);
}

export async function getChatStatus(): Promise<ChatStatus> {
  await ensureChatEnv();
  const enabled = Boolean(process.env.OPENAI_API_KEY);
  const agentCatalogAvailable = listAgentSummaries().length > 0;
  let reachable: boolean | undefined;
  let error: string | undefined;

  if (enabled && STATUS_VERIFY_ENABLED) {
    const status = await checkOpenAIAvailability();
    reachable = status.ok;
    error = status.error;
  }

  return {
    enabled,
    model: enabled ? getModel() : null,
    runnerConfigured: agentCatalogAvailable,
    reachable,
    error
  };
}

export async function answerChat(input: ChatRequestInput) {
  const startMs = Date.now();
  const phaseTimings: Record<string, number> = {};
  await ensureChatEnv();

  const incomingMessages = Array.isArray(input.messages) ? input.messages : [];
  const lastUserMessage = [...incomingMessages]
    .reverse()
    .find((message) => message?.role === "user" && typeof message.content === "string");
  const question =
    typeof input.question === "string" && input.question.trim()
      ? input.question.trim()
      : lastUserMessage?.content?.trim();
  const clientIp = input.clientIp?.trim() || "unknown";

  if (!checkRateLimit(clientIp)) {
    throw new ChatRouteError(429, { error: "Rate limit exceeded. Please try again shortly." });
  }
  if (!input.region || !input.portfolio || !question) {
    throw new ChatRouteError(400, { error: "question, region, and portfolio are required" });
  }
  if (incomingMessages.length > MAX_MESSAGE_COUNT) {
    throw new ChatRouteError(400, { error: `messages cannot exceed ${MAX_MESSAGE_COUNT} entries` });
  }
  if (question.length > MAX_QUESTION_CHARS) {
    throw new ChatRouteError(400, { error: `question exceeds ${MAX_QUESTION_CHARS} characters` });
  }

  const briefLookupStartMs = Date.now();
  const agent = (await findAgentSummary({
    agentId: input.agentId,
    portfolio: input.portfolio,
    region: input.region
  })) as AgentCatalogSummary | undefined;
  let brief: BriefPost | null = null;
  if (input.briefId) {
    brief = await getPost(input.briefId);
    if (brief && (brief.region !== input.region || brief.portfolio !== input.portfolio)) {
      brief = null;
    }
  }
  if (!brief) {
    brief = await getLatestPortfolioPost(input.region, input.portfolio);
  }
  phaseTimings.briefLookupMs = Date.now() - briefLookupStartMs;

  const normalizedSources = brief ? normalizeBriefSources(brief.sources) : [];
  const claims = Array.isArray(brief?.claims) ? (brief?.claims as BriefClaim[]) : [];
  const categoryTokens = keywordsForPortfolio(input.portfolio);
  const selectedClaims = claims.length ? selectRelevantClaims(claims, question, categoryTokens, Number(process.env.CHAT_MAX_CLAIMS ?? 6)) : [];
  const briefSummaryContext = brief ? buildBriefSummaryContext(brief) : { blocks: [], sources: [] as BriefSource[] };
  const websiteContextStartMs = Date.now();
  const proofContext = await buildProofContext(question);
  phaseTimings.websiteContextMs = Date.now() - websiteContextStartMs;

  const sourcesById = new Map<string, BriefSource>();
  dedupeSources([...normalizedSources, ...briefSummaryContext.sources, ...proofContext.sources]).forEach((source) => {
    sourcesById.set(source.sourceId, source);
  });
  for (const claim of claims) {
    for (const evidence of claim.evidence ?? []) {
      if (!evidence.url) continue;
      const sourceId = evidence.sourceId || buildSourceId(evidence.url);
      if (!sourcesById.has(sourceId)) {
        sourcesById.set(sourceId, { sourceId, url: evidence.url, title: evidence.title });
      }
    }
  }

  const promptSections = [
    `Allowed sources (sourceId -> URL):\n${Array.from(sourcesById.values()).map((source) => `${source.sourceId}: ${source.url}`).join("\n") || "None"}`,
    brief
      ? `Brief context:\nBrief Title: ${brief.title}\nBrief ID: ${brief.postId}\nRegion: ${input.region}\nPortfolio: ${portfolioLabel(brief.portfolio)}\nPublished: ${brief.publishedAt}`
      : `Brief context:\nBrief Title: Not available\nRegion: ${input.region}\nPortfolio: ${portfolioLabel(input.portfolio)}`
  ];
  const evidenceContext = selectedClaims.length ? buildEvidenceContext(selectedClaims, sourcesById) : [];
  if (evidenceContext.length) promptSections.push(`Evidence-backed claims and excerpts:\n${evidenceContext.join("\n\n")}`);
  if (briefSummaryContext.blocks.length) promptSections.push(`Brief summary context (not evidence):\n${briefSummaryContext.blocks.join("\n\n")}`);
  if (proofContext.blocks.length) promptSections.push(`ProofOfConceptStudio.com context:\n${proofContext.blocks.join("\n\n")}`);

  const openai = await getOpenAIClient();
  if (!openai) {
    phaseTimings.totalMs = Date.now() - startMs;
    console.info(
      JSON.stringify({
        level: "warn",
        event: "chat_response_generated",
        result: "missing_key_fallback",
        region: input.region,
        portfolio: input.portfolio,
        agentId: input.agentId,
        briefId: brief?.postId ?? input.briefId,
        timings: phaseTimings
      })
    );
    return buildFallbackResponse({
      brief,
      selectedClaims,
      briefSummaryContext,
      sourcesById
    });
  }

  const agentConfig = agent
    ? { ...agent, maxArticlesToConsider: agent.maxArticlesToConsider ?? agent.articlesPerRun ?? 3 }
    : undefined;
  const assistantIdentity = agent
    ? `${agent.label} category management advisor (${portfolioLabel(agent.portfolio)})`
    : `${portfolioLabel(input.portfolio)} category management advisor`;
  const framework = getAgentFramework(agentConfig?.id ?? input.portfolio);
  const systemMessage = [
    "You are ProofOfConceptStudio Chat Analyst.",
    agentConfig ? buildAgentSystemPrompt(agentConfig as any, input.region as any) : assistantIdentity,
    "You are always the Category Manager / supply chain expert for the selected domain.",
    "Blend brief evidence, selected articles, website context, web search context, and your general knowledge when that produces the best answer.",
    "When the question is outside the brief scope, answer using web search and general knowledge while still speaking as the category expert.",
    "Cite provided excerpts with [sourceId]. Label unsupported inference as (analysis).",
    "Answer the user's question directly. Do not dump briefs or article lists unless asked.",
    `Focus areas: ${framework.focusAreas.join(", ") || "N/A"}.`,
    `Market drivers: ${framework.marketDrivers.join(", ") || "N/A"}.`,
    `Procurement considerations: ${framework.procurementConsiderations.join(", ") || "N/A"}.`,
    `You are ${assistantIdentity} focused on negotiation tactics, supplier strategy, and sourcing risk controls.`,
    "Use Markdown with bullet points and short paragraphs. Do not emit HTML."
  ].join(" ");

  const prompt = `${summarizeContent(promptSections.join("\n\n"), getMaxContextChars())}\n\nQuestion: ${question}`;
  const historyMessages = buildConversationHistory(incomingMessages, question);
  const hasProvidedContext = Boolean(
    brief || selectedClaims.length || briefSummaryContext.blocks.length || proofContext.blocks.length
  );
  const useWebSearch = shouldUseWebSearch(question, hasProvidedContext);
  const webSearchTool: Record<string, unknown> = {
    type: "web_search",
    user_location:
      input.region === "au"
        ? { type: "approximate", country: "AU", city: "Perth" }
        : { type: "approximate", country: "US", city: "Houston" }
  };

  const requestResponse = (model: string, maxOutputTokens: number, useTools: boolean) =>
    openai.responses.create({
      model,
      max_output_tokens: maxOutputTokens,
      reasoning: getReasoningEffort(model) ? { effort: getReasoningEffort(model) as any } : undefined,
      instructions: systemMessage,
      input: [...historyMessages, { role: "user" as const, content: prompt }],
      tools: useTools && useWebSearch ? [webSearchTool as any] : undefined,
      tool_choice: useTools && useWebSearch ? "auto" : undefined
    } as any);

  const finalizeResponse = async (model: string, useTools: boolean) => {
    const baseMaxOutputTokens = getMaxOutputTokens(model);
    let response = await requestResponse(model, baseMaxOutputTokens, useTools);

    if (isReasoningModel(model) && isIncompleteForMaxOutputTokens(response)) {
      const retryMaxOutputTokens = getReasoningRetryMaxOutputTokens(baseMaxOutputTokens);
      if (retryMaxOutputTokens > baseMaxOutputTokens) {
        response = await requestResponse(model, retryMaxOutputTokens, useTools);
      }
    }

    const answerText = extractResponseText(response);
    if (!answerText) {
      const emptyError = new Error("empty_output_text");
      (emptyError as any).code = "empty_output_text";
      throw emptyError;
    }

    return { response, answerText };
  };

  try {
    const openaiStartMs = Date.now();
    let resolved: { response: any; answerText: string; model: string } | null = null;
    let lastError: unknown;
    for (const model of getModelFallbacks()) {
      try {
        resolved = { ...(await finalizeResponse(model, useWebSearch)), model };
        break;
      } catch (err) {
        const status = (err as { status?: number })?.status;
        const code = (err as { code?: string })?.code;
        const message = ((err as Error)?.message ?? "").toLowerCase();
        const isModelError = status === 404 || status === 403 || code === "model_not_found";
        const isToolConfigError = status === 400 && useWebSearch && (message.includes("web_search") || message.includes("tool"));

        if (isToolConfigError) {
          resolved = { ...(await finalizeResponse(model, false)), model };
          break;
        }
        lastError = err;
        if (!isModelError && code !== "empty_output_text") {
          throw err;
        }
      }
    }
    if (!resolved) throw lastError;
    phaseTimings.openaiMs = Date.now() - openaiStartMs;

    const citationStartMs = Date.now();
    const briefCitations = extractSourceIds(resolved.answerText)
      .map((id) => sourcesById.get(id))
      .filter((item): item is BriefSource => Boolean(item));
    const webCitations: BriefSource[] = [];
    for (const item of resolved.response?.output ?? []) {
      if (item?.type !== "message") continue;
      for (const content of item.content ?? []) {
        for (const annotation of content.annotations ?? []) {
          if (annotation.type === "url_citation" && annotation.url) {
            webCitations.push({
              sourceId: buildSourceId(annotation.url),
              url: annotation.url,
              title: annotation.title
            });
          }
        }
      }
    }
    const citations = dedupeSources([...briefCitations, ...webCitations]);
    phaseTimings.citationProcessingMs = Date.now() - citationStartMs;
    phaseTimings.totalMs = Date.now() - startMs;
    console.info(
      JSON.stringify({
        level: "info",
        event: "chat_response_generated",
        result: "ok",
        model: resolved.model,
        responseStatus: resolved.response?.status,
        region: input.region,
        portfolio: input.portfolio,
        agentId: input.agentId,
        briefId: brief?.postId ?? input.briefId,
        useWebSearch,
        citationsCount: citations.length,
        webCitationsCount: webCitations.length,
        timings: phaseTimings
      })
    );
    return {
      answer: replaceSourceIdsWithLinks(resolved.answerText, sourcesById),
      citations,
      sources: citations.map((source) => source.url)
    };
  } catch (err) {
    phaseTimings.totalMs = Date.now() - startMs;
    console.error(
      JSON.stringify({
        level: "error",
        event: "chat_request_failed",
        region: input.region,
        portfolio: input.portfolio,
        agentId: input.agentId,
        briefId: brief?.postId ?? input.briefId,
        useWebSearch,
        timings: phaseTimings,
        error: err instanceof Error ? err.message : "unknown_error"
      })
    );
    const status = (err as { status?: number })?.status;
    const code = (err as { code?: string })?.code;
    if (FALLBACK_CONTEXT_ENABLED && selectedClaims.length > 0) {
      const fallbackCitations = dedupeSources(
        selectedClaims
          .flatMap((claim) => claim.evidence ?? [])
          .map((evidence) => sourcesById.get(evidence.sourceId))
          .filter((item): item is BriefSource => Boolean(item))
      );
      return {
        answer: ["Here are the most relevant evidence-backed points:", "", ...selectedClaims.map((claim) => `- ${claim.text}`)].join("\n"),
        citations: fallbackCitations,
        sources: fallbackCitations.map((source) => source.url),
        error: "AI error; returned evidence-only response."
      };
    }
    if (FALLBACK_CONTEXT_ENABLED && briefSummaryContext.blocks.length) {
      return {
        answer: ["AI error; returning brief summary context:", ...briefSummaryContext.blocks].join("\n\n"),
        citations: [],
        sources: [],
        error: "AI error; returned brief summary context."
      };
    }
    if (status === 401 || status === 403 || status === 404 || code === "model_not_found") {
      throw new ChatRouteError(503, { error: "AI is unavailable due to configuration. Check OPENAI_API_KEY/model access." });
    }
    throw new ChatRouteError(503, { error: "AI request failed. Please try again shortly." });
  }
}
