import {
  BriefClaim,
  BriefPost,
  BriefSource,
  MarketIndex,
  SelectedArticle,
  buildSourceId,
  normalizeBriefSources
} from "@proof/shared";
import type { ArticleInput } from "../llm/openai.js";
import { fetchArticleDetails } from "../ingest/extract.js";
import type { DynamoBriefItem } from "./shared.js";

const DEFAULT_MAX_REWRITE_SOURCES = 8;
const MAX_CONTEXT_CHARS = 6_000;

interface RewriteSourceCandidate {
  url: string;
  title: string;
  publishedAt?: string;
  sourceName?: string;
  selectedArticle?: SelectedArticle;
  source?: BriefSource;
}

type FetchDetailsFn = typeof fetchArticleDetails;

function normalizeUrl(url?: string): string {
  return (url ?? "").trim().replace(/\/$/, "").toLowerCase();
}

function stripMarkdown(text?: string): string {
  return (text ?? "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/[#>*_~\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    const cleaned = (value ?? "").replace(/\s+/g, " ").trim();
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(cleaned);
  }
  return output;
}

function sourceIdForUrl(url: string): string {
  return buildSourceId(url);
}

function isIndexUrl(url: string, indices: MarketIndex[]): boolean {
  const normalized = normalizeUrl(url);
  return indices.some((index) => normalizeUrl(index.url) === normalized);
}

function fallbackBriefContext(brief: BriefPost): string[] {
  return uniqueStrings([
    brief.summary,
    stripMarkdown(brief.bodyMarkdown).slice(0, 1200)
  ]);
}

function evidenceBySourceId(claims: BriefClaim[] | undefined): Map<string, { excerpts: string[]; texts: string[] }> {
  const bySourceId = new Map<string, { excerpts: string[]; texts: string[] }>();
  for (const claim of claims ?? []) {
    for (const evidence of claim.evidence ?? []) {
      const existing = bySourceId.get(evidence.sourceId) ?? { excerpts: [], texts: [] };
      if (evidence.excerpt) existing.excerpts.push(evidence.excerpt);
      if (claim.text) existing.texts.push(claim.text);
      bySourceId.set(evidence.sourceId, existing);
    }
  }
  return bySourceId;
}

function clipContext(text: string, maxChars = MAX_CONTEXT_CHARS): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxChars) return cleaned;
  return `${cleaned.slice(0, maxChars - 3).trim()}...`;
}

export function collectRewriteSourceCandidates(
  brief: BriefPost,
  indices: MarketIndex[],
  maxSources = DEFAULT_MAX_REWRITE_SOURCES
): RewriteSourceCandidate[] {
  const candidates: RewriteSourceCandidate[] = [];
  const seen = new Set<string>();

  for (const article of brief.selectedArticles ?? []) {
    if (!article.url || isIndexUrl(article.url, indices)) continue;
    const key = normalizeUrl(article.url);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    candidates.push({
      url: article.url,
      title: article.title,
      publishedAt: article.publishedAt,
      sourceName: article.sourceName,
      selectedArticle: article
    });
    if (candidates.length >= maxSources) return candidates;
  }

  for (const source of normalizeBriefSources(brief.sources)) {
    if (!source.url || isIndexUrl(source.url, indices)) continue;
    const key = normalizeUrl(source.url);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const matchingSelected = (brief.selectedArticles ?? []).find((article) => normalizeUrl(article.url) === key);
    candidates.push({
      url: source.url,
      title: matchingSelected?.title ?? source.title ?? source.url,
      publishedAt: matchingSelected?.publishedAt ?? source.publishedAt,
      sourceName: matchingSelected?.sourceName,
      selectedArticle: matchingSelected,
      source
    });
    if (candidates.length >= maxSources) return candidates;
  }

  return candidates;
}

function buildCandidateFallbackContent(
  brief: BriefPost,
  candidate: RewriteSourceCandidate,
  evidenceMap: Map<string, { excerpts: string[]; texts: string[] }>
): string {
  const sourceId = candidate.selectedArticle?.sourceId ?? sourceIdForUrl(candidate.url);
  const evidence = evidenceMap.get(sourceId);
  const specificContext = uniqueStrings([
    candidate.selectedArticle?.briefContent,
    candidate.selectedArticle?.categoryImportance,
    candidate.selectedArticle?.procurementLens?.buyerTakeaway,
    candidate.selectedArticle?.procurementLens?.costMoney,
    candidate.selectedArticle?.procurementLens?.supplierCommercial,
    candidate.selectedArticle?.procurementLens?.safetyOperational,
    candidate.selectedArticle?.procurementLens?.watchouts,
    ...(candidate.selectedArticle?.keyMetrics ?? []),
    ...(evidence?.texts ?? []).slice(0, 4),
    ...(evidence?.excerpts ?? []).slice(0, 6)
  ]);
  return clipContext(
    uniqueStrings([...specificContext, ...(specificContext.length > 0 ? [] : fallbackBriefContext(brief))]).join(" ")
  );
}

export async function buildRewriteArticleInputs(params: {
  brief: BriefPost;
  indices: MarketIndex[];
  fetchDetails?: FetchDetailsFn;
  maxSources?: number;
}): Promise<ArticleInput[]> {
  const fetchDetails = params.fetchDetails ?? fetchArticleDetails;
  const candidates = collectRewriteSourceCandidates(params.brief, params.indices, params.maxSources);
  if (candidates.length === 0) {
    throw new Error("No rewrite article candidates were found on the published brief.");
  }

  const evidenceMap = evidenceBySourceId(params.brief.claims);
  const articleInputs: ArticleInput[] = [];

  for (const candidate of candidates) {
    const fetched = await fetchDetails(candidate.url).catch(() => ({
      url: candidate.url,
      title: candidate.title,
      content: "",
      sourceName: candidate.sourceName,
      publishedAt: candidate.publishedAt,
      ogImageUrl: undefined
    }));

    const content = clipContext(
      uniqueStrings([
        fetched.content,
        buildCandidateFallbackContent(params.brief, candidate, evidenceMap)
      ]).join(" ")
    );

    articleInputs.push({
      title: fetched.title || candidate.title,
      url: candidate.url,
      content,
      ogImageUrl: fetched.ogImageUrl ?? candidate.selectedArticle?.imageUrl,
      sourceName: fetched.sourceName ?? candidate.sourceName,
      publishedAt: fetched.publishedAt ?? candidate.publishedAt,
      contentStatus: content.length >= 250 ? "ok" : "thin"
    });
  }

  return articleInputs;
}

export function mergeRewrittenBriefItem(params: {
  item: DynamoBriefItem;
  rewrittenBrief: BriefPost;
}): DynamoBriefItem {
  const { item, rewrittenBrief } = params;
  return {
    ...item,
    ...rewrittenBrief,
    postId: item.postId,
    runKey: item.runKey,
    briefDay: item.briefDay,
    publishedAt: item.publishedAt,
    region: item.region,
    portfolio: item.portfolio,
    runWindow: item.runWindow,
    agentId: item.agentId ?? rewrittenBrief.agentId,
    status: "published",
    generationStatus: "published",
    version: "v2",
    PK: item.PK,
    SK: item.SK,
    GSI1PK: item.GSI1PK,
    GSI1SK: item.GSI1SK,
    GSI2PK: item.GSI2PK,
    GSI2SK: item.GSI2SK,
    GSI3PK: item.GSI3PK,
    GSI3SK: item.GSI3SK,
    ttl: item.ttl,
    runId: item.runId
  };
}
