import crypto from "node:crypto";
import {
  BriefClaim,
  BriefClaimSection,
  BriefClaimStatus,
  BriefEvidence,
  BriefMarketIndicator,
  BriefPost,
  BriefSource,
  SelectedArticle,
  buildSourceId,
  dedupeSources
} from "@proof/shared";
import type { ArticleInput } from "../llm/prompts.js";
import type { MarketCandidate } from "../llm/market-prompts.js";
import { parseEvidenceTag, parseMarketEvidenceTag, stripEvidenceTag } from "./factuality.js";

const STOPWORDS = new Set([
  "the","and","for","with","that","this","from","into","over","under","about","while","when","where","which","what",
  "will","would","could","should","a","an","of","to","in","on","by","at","is","are","was","were","be","been","it",
  "as","or","if","than","then","but","so","we","they","their","our","your","its","these","those"
]);

const DEFAULT_SIMILARITY_THRESHOLD = Number(process.env.EVIDENCE_SIMILARITY_THRESHOLD ?? 0.14);
const DEFAULT_AUTO_MATCH_THRESHOLD = Number(process.env.EVIDENCE_AUTO_MATCH_THRESHOLD ?? 0.2);

type EvidenceTag = { kind: "source"; index: number } | { kind: "analysis" } | { kind: "none" };

interface EvidenceCorpusEntry {
  index: number;
  url: string;
  title?: string;
  content?: string;
  publishedAt?: string;
  contentStatus?: ArticleInput["contentStatus"];
}

interface EvidenceResult {
  brief: BriefPost;
  claims: BriefClaim[];
  sources: BriefSource[];
  issues: string[];
  stats: { supported: number; analysis: number; needsVerification: number; total: number };
}

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? [])
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
}

function cosineSimilarity(a: string, b: string): number {
  const tokensA = tokenize(a);
  const tokensB = tokenize(b);
  if (tokensA.length === 0 || tokensB.length === 0) return 0;
  const freqA = new Map<string, number>();
  const freqB = new Map<string, number>();
  tokensA.forEach((t) => freqA.set(t, (freqA.get(t) ?? 0) + 1));
  tokensB.forEach((t) => freqB.set(t, (freqB.get(t) ?? 0) + 1));
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const [, count] of freqA) normA += count * count;
  for (const [, count] of freqB) normB += count * count;
  for (const [token, count] of freqA) {
    const other = freqB.get(token);
    if (other) dot += count * other;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

function splitSentences(text: string): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  return normalized.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [];
}

function findBestExcerpt(claim: string, content: string): { excerpt: string; similarity: number } {
  const sentences = splitSentences(content);
  if (sentences.length === 0) return { excerpt: "", similarity: 0 };

  let best = sentences[0];
  let bestScore = cosineSimilarity(claim, best);

  for (let i = 0; i < sentences.length; i++) {
    const candidate = sentences[i];
    const score = cosineSimilarity(claim, candidate);
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
    if (i + 1 < sentences.length) {
      const combined = `${sentences[i]} ${sentences[i + 1]}`;
      const combinedScore = cosineSimilarity(claim, combined);
      if (combinedScore > bestScore) {
        bestScore = combinedScore;
        best = combined;
      }
    }
  }

  const clipped = best.length > 520 ? `${best.slice(0, 517).trim()}...` : best.trim();
  return { excerpt: clipped, similarity: bestScore };
}

function hashExcerpt(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function findOffsets(content: string, excerpt: string): { start?: number; end?: number } {
  if (!content || !excerpt) return {};
  const index = content.indexOf(excerpt);
  if (index === -1) return {};
  return { start: index, end: index + excerpt.length };
}

function buildClaimId(section: BriefClaimSection, text: string, index: number): string {
  const seed = `${section}:${index}:${text}`;
  return `claim_${hashExcerpt(seed).slice(0, 10)}`;
}

function isNumericClaim(text: string): boolean {
  return /(\d|\$|%|€|£|¥)/.test(text);
}

function selectedIndicesFromArticles(articles?: SelectedArticle[]): Set<number> {
  const indices = new Set<number>();
  (articles ?? []).forEach((article) => {
    const idx = Number(article.sourceIndex);
    if (Number.isInteger(idx) && idx > 0) indices.add(idx);
  });
  return indices;
}

function parseEvidence(text: string, kind: "article" | "candidate"): EvidenceTag {
  if (kind === "candidate") {
    const tag = parseMarketEvidenceTag(text);
    if (tag.kind === "analysis") return { kind: "analysis" };
    if (tag.kind === "source") return { kind: "source", index: tag.candidateIndex };
    return { kind: "none" };
  }
  const tag = parseEvidenceTag(text);
  if (tag.kind === "analysis") return { kind: "analysis" };
  if (tag.kind === "source") return { kind: "source", index: tag.articleIndex };
  return { kind: "none" };
}

function guessEvidenceIndex(claim: string, corpus: EvidenceCorpusEntry[]): number | undefined {
  let bestScore = 0;
  let bestIndex: number | undefined;
  for (const entry of corpus) {
    if (!entry.content) continue;
    const { excerpt, similarity } = findBestExcerpt(claim, entry.content);
    if (!excerpt) continue;
    if (similarity > bestScore) {
      bestScore = similarity;
      bestIndex = entry.index;
    }
  }
  if (bestScore >= DEFAULT_AUTO_MATCH_THRESHOLD) return bestIndex;
  return undefined;
}

function buildEvidenceForClaim(params: {
  claimText: string;
  evidenceIndex?: number;
  corpusByIndex: Map<number, EvidenceCorpusEntry>;
  sourceCatalog: Map<number, BriefSource>;
}): { evidence: BriefEvidence[]; similarity?: number } {
  const { claimText, evidenceIndex, corpusByIndex, sourceCatalog } = params;
  if (!evidenceIndex) return { evidence: [] };
  const entry = corpusByIndex.get(evidenceIndex);
  if (!entry || !entry.content || entry.contentStatus === "thin") {
    return { evidence: [] };
  }
  const { excerpt, similarity } = findBestExcerpt(claimText, entry.content);
  if (!excerpt) return { evidence: [] };
  const offsets = findOffsets(entry.content, excerpt);
  const sourceId = buildSourceId(entry.url);
  const source =
    sourceCatalog.get(evidenceIndex) ?? {
      sourceId,
      url: entry.url,
      title: entry.title,
      publishedAt: entry.publishedAt
    };
  const evidence: BriefEvidence = {
    sourceId: source.sourceId,
    url: source.url,
    title: source.title,
    excerpt,
    startOffset: offsets.start,
    endOffset: offsets.end,
    contentHash: hashExcerpt(excerpt),
    similarity
  };
  return { evidence: [evidence], similarity };
}

function stripTags(value?: string): string {
  if (!value) return "";
  return stripEvidenceTag(value);
}

function cleanTextArray(values?: string[]): string[] {
  return (values ?? []).map(stripTags).filter((v) => v.length > 0);
}

function cleanSelectedArticles(articles?: SelectedArticle[]): SelectedArticle[] | undefined {
  if (!articles) return articles;
  return articles.map((article) => ({
    ...article,
    sourceId: article.url ? buildSourceId(article.url) : article.sourceId,
    briefContent: stripTags(article.briefContent),
    categoryImportance: article.categoryImportance ? stripTags(article.categoryImportance) : undefined,
    keyMetrics: article.keyMetrics ? cleanTextArray(article.keyMetrics) : undefined
  }));
}

function cleanIndicators(indicators?: BriefMarketIndicator[]): BriefMarketIndicator[] | undefined {
  if (!indicators) return indicators;
  return indicators.map((indicator) => ({
    ...indicator,
    sourceId: indicator.url ? buildSourceId(indicator.url) : indicator.sourceId,
    note: stripTags(indicator.note)
  }));
}

function cleanVpSnapshot(snapshot?: BriefPost["vpSnapshot"]): BriefPost["vpSnapshot"] {
  if (!snapshot) return snapshot;
  return {
    ...snapshot,
    health: snapshot.health
      ? { ...snapshot.health, narrative: stripTags(snapshot.health.narrative ?? "") }
      : snapshot.health,
    topSignals: snapshot.topSignals?.map((signal) => ({
      ...signal,
      title: stripTags(signal.title),
      impact: stripTags(signal.impact)
    })),
    recommendedActions: snapshot.recommendedActions?.map((action) => ({
      ...action,
      action: stripTags(action.action),
      expectedImpact: stripTags(action.expectedImpact)
    })),
    riskRegister: snapshot.riskRegister?.map((risk) => ({
      ...risk,
      risk: stripTags(risk.risk),
      mitigation: stripTags(risk.mitigation),
      trigger: stripTags(risk.trigger)
    }))
  };
}

function cleanCmSnapshot(snapshot?: BriefPost["cmSnapshot"]): BriefPost["cmSnapshot"] {
  if (!snapshot) return snapshot;
  return {
    ...snapshot,
    todayPriorities: snapshot.todayPriorities?.map((item) => ({
      ...item,
      title: stripTags(item.title),
      why: stripTags(item.why)
    })),
    supplierRadar: snapshot.supplierRadar?.map((item) => ({
      ...item,
      supplier: stripTags(item.supplier),
      signal: stripTags(item.signal),
      implication: stripTags(item.implication),
      nextStep: stripTags(item.nextStep)
    })),
    negotiationLevers: snapshot.negotiationLevers?.map((item) => ({
      ...item,
      lever: stripTags(item.lever),
      whenToUse: stripTags(item.whenToUse),
      expectedOutcome: stripTags(item.expectedOutcome)
    })),
    intelGaps: snapshot.intelGaps ? cleanTextArray(snapshot.intelGaps) : snapshot.intelGaps,
    talkingPoints: snapshot.talkingPoints ? cleanTextArray(snapshot.talkingPoints) : snapshot.talkingPoints
  };
}

function cleanDecisionSummary(summary?: BriefPost["decisionSummary"]): BriefPost["decisionSummary"] {
  if (!summary) return summary;
  return {
    topMove: stripTags(summary.topMove),
    whatChanged: cleanTextArray(summary.whatChanged),
    doNext: cleanTextArray(summary.doNext),
    watchThisWeek: cleanTextArray(summary.watchThisWeek)
  };
}

function buildSourceCatalog(params: {
  selectedArticles?: SelectedArticle[];
  marketIndicators?: BriefMarketIndicator[];
  corpusByIndex: Map<number, EvidenceCorpusEntry>;
  nowIso: string;
}): { sources: BriefSource[]; indexToSource: Map<number, BriefSource> } {
  const { selectedArticles, marketIndicators, corpusByIndex, nowIso } = params;
  const sources: BriefSource[] = [];
  const indexToSource = new Map<number, BriefSource>();

  for (const entry of corpusByIndex.values()) {
    const source: BriefSource = {
      sourceId: buildSourceId(entry.url),
      url: entry.url,
      title: entry.title,
      publishedAt: entry.publishedAt,
      retrievedAt: nowIso
    };
    indexToSource.set(entry.index, source);
  }

  (selectedArticles ?? []).forEach((article) => {
    if (!article.url) return;
    const sourceId = buildSourceId(article.url);
    const source: BriefSource = {
      sourceId,
      url: article.url,
      title: article.title,
      publishedAt: article.publishedAt,
      retrievedAt: nowIso
    };
    sources.push(source);
  });

  (marketIndicators ?? []).forEach((indicator) => {
    if (!indicator.url) return;
    sources.push({
      sourceId: buildSourceId(indicator.url),
      url: indicator.url,
      title: indicator.label,
      retrievedAt: nowIso
    });
  });

  return { sources, indexToSource };
}

function buildClaims(params: {
  brief: BriefPost;
  corpus: EvidenceCorpusEntry[];
  parseKind: "article" | "candidate";
  nowIso: string;
}): EvidenceResult {
  const { brief, corpus, parseKind, nowIso } = params;
  const selectedIndices = selectedIndicesFromArticles(brief.selectedArticles);
  const allowedIndices = selectedIndices.size ? selectedIndices : new Set(corpus.map((entry) => entry.index));
  const corpusForMatch = selectedIndices.size
    ? corpus.filter((entry) => allowedIndices.has(entry.index))
    : corpus;
  const corpusByIndex = new Map<number, EvidenceCorpusEntry>();
  corpus.forEach((entry) => corpusByIndex.set(entry.index, entry));
  const { sources: sourceCatalog, indexToSource } = buildSourceCatalog({
    selectedArticles: brief.selectedArticles,
    marketIndicators: brief.marketIndicators,
    corpusByIndex,
    nowIso
  });

  const claims: BriefClaim[] = [];
  const issues: string[] = [];
  let supported = 0;
  let analysis = 0;
  let needsVerification = 0;
  let claimIndex = 0;
  const autoAnalysisSections = new Set<BriefClaimSection>(["summary", "highlight", "delta"]);

  const addClaim = (section: BriefClaimSection, rawText: string, fallbackIndex?: number) => {
    const cleaned = stripTags(rawText);
    if (!cleaned) return;
    const tag = parseEvidence(rawText, parseKind);
    let evidenceIndex = tag.kind === "source" ? tag.index : undefined;
    if (!evidenceIndex && fallbackIndex) {
      evidenceIndex = fallbackIndex;
    }
    if (evidenceIndex && !allowedIndices.has(evidenceIndex)) {
      issues.push(`Evidence tag references non-selected index ${evidenceIndex} for section ${section}.`);
      evidenceIndex = undefined;
    }
    if (evidenceIndex && !corpusByIndex.has(evidenceIndex)) {
      issues.push(`Evidence tag references unknown index ${evidenceIndex} for section ${section}.`);
      evidenceIndex = undefined;
    }
    if (!evidenceIndex && tag.kind === "none") {
      evidenceIndex = guessEvidenceIndex(cleaned, corpusForMatch);
    }

    let status: BriefClaimStatus = "needs_verification";
    let evidence: BriefEvidence[] = [];
    let similarity: number | undefined;

    if (tag.kind === "analysis") {
      status = "analysis";
    } else {
      const evidenceResult = buildEvidenceForClaim({
        claimText: cleaned,
        evidenceIndex,
        corpusByIndex,
        sourceCatalog: indexToSource
      });
      evidence = evidenceResult.evidence;
      similarity = evidenceResult.similarity;
      if (evidence.length > 0 && (similarity ?? 0) >= DEFAULT_SIMILARITY_THRESHOLD) {
        status = "supported";
      } else {
        status = "needs_verification";
      }
    }

    if (status === "needs_verification" && tag.kind === "none" && autoAnalysisSections.has(section)) {
      status = "analysis";
    }

    const claimId = buildClaimId(section, cleaned, claimIndex++);
    claims.push({
      id: claimId,
      section,
      text: cleaned,
      status,
      evidence
    });

    if (status === "supported") supported += 1;
    else if (status === "analysis") analysis += 1;
    else needsVerification += 1;
  };

  addClaim("summary", brief.summary ?? "");
  (brief.highlights ?? []).forEach((item) => addClaim("highlight", item));
  (brief.procurementActions ?? []).forEach((item) => addClaim("procurement_action", item));
  (brief.watchlist ?? []).forEach((item) => addClaim("watchlist", item));
  (brief.deltaSinceLastRun ?? []).forEach((item) => addClaim("delta", item));

  (brief.selectedArticles ?? []).forEach((article) => {
    if (article.briefContent) {
      addClaim("top_story", article.briefContent, article.sourceIndex);
    }
    if (article.categoryImportance) {
      addClaim("category_importance", article.categoryImportance, article.sourceIndex);
    }
    (article.keyMetrics ?? []).forEach((metric) => addClaim("top_story", metric, article.sourceIndex));
  });

  (brief.marketIndicators ?? []).forEach((indicator) => {
    addClaim("market_indicator", indicator.note);
  });

  if (brief.vpSnapshot) {
    if (brief.vpSnapshot.health?.narrative) {
      addClaim("vp_snapshot", brief.vpSnapshot.health.narrative);
    }
    (brief.vpSnapshot.topSignals ?? []).forEach((signal) => {
      addClaim("vp_snapshot", signal.title, signal.evidenceArticleIndex);
      addClaim("vp_snapshot", signal.impact, signal.evidenceArticleIndex);
    });
    (brief.vpSnapshot.recommendedActions ?? []).forEach((action) => {
      addClaim("vp_snapshot", action.action, action.evidenceArticleIndex);
      addClaim("vp_snapshot", action.expectedImpact, action.evidenceArticleIndex);
    });
    (brief.vpSnapshot.riskRegister ?? []).forEach((risk) => {
      addClaim("vp_snapshot", risk.risk, risk.evidenceArticleIndex);
      addClaim("vp_snapshot", risk.mitigation, risk.evidenceArticleIndex);
      addClaim("vp_snapshot", risk.trigger, risk.evidenceArticleIndex);
    });
  }

  if (brief.cmSnapshot) {
    (brief.cmSnapshot.todayPriorities ?? []).forEach((item) => {
      addClaim("cm_snapshot", item.title, item.evidenceArticleIndex);
      addClaim("cm_snapshot", item.why, item.evidenceArticleIndex);
    });
    (brief.cmSnapshot.supplierRadar ?? []).forEach((item) => {
      addClaim("cm_snapshot", item.supplier, item.evidenceArticleIndex);
      addClaim("cm_snapshot", item.signal, item.evidenceArticleIndex);
      addClaim("cm_snapshot", item.implication, item.evidenceArticleIndex);
      addClaim("cm_snapshot", item.nextStep, item.evidenceArticleIndex);
    });
    (brief.cmSnapshot.negotiationLevers ?? []).forEach((item) => {
      addClaim("cm_snapshot", item.lever, item.evidenceArticleIndex);
      addClaim("cm_snapshot", item.whenToUse, item.evidenceArticleIndex);
      addClaim("cm_snapshot", item.expectedOutcome, item.evidenceArticleIndex);
    });
    (brief.cmSnapshot.intelGaps ?? []).forEach((item) => addClaim("cm_snapshot", item));
    (brief.cmSnapshot.talkingPoints ?? []).forEach((item) => addClaim("cm_snapshot", item));
  }

  claims.forEach((claim) => {
    const isStrictSection =
      claim.section === "procurement_action" ||
      claim.section === "watchlist" ||
      (claim.section === "top_story" && isNumericClaim(claim.text));
    if (claim.status === "needs_verification" && isStrictSection) {
      issues.push(`Claim needs verification: ${claim.section} "${claim.text.slice(0, 120)}"`);
    }
  });

  const usedSourceIds = new Set<string>();
  for (const claim of claims) {
    if (claim.status !== "supported") continue;
    claim.evidence.forEach((evidenceItem) => usedSourceIds.add(evidenceItem.sourceId));
  }

  // Primary: sources referenced by supported claims.
  // Always include the "core" sources (selected articles + market indicators) even if not yet
  // supported by evidence matching. These are user-visible and must retain attribution URLs.
  const coreSources = dedupeSources(sourceCatalog);
  let sources = dedupeSources(sourceCatalog.filter((source) => usedSourceIds.has(source.sourceId)));
  sources = dedupeSources([...sources, ...coreSources]);
  // When no sources exist at all, validation still requires at least one source.
  if (sources.length === 0 && coreSources.length > 0) {
    sources = coreSources.slice(0, 10);
  }

  const cleanedBrief: BriefPost = {
    ...brief,
    title: brief.title ? stripTags(brief.title) : brief.title,
    summary: brief.summary ? stripTags(brief.summary) : brief.summary,
    highlights: cleanTextArray(brief.highlights),
    procurementActions: cleanTextArray(brief.procurementActions),
    watchlist: cleanTextArray(brief.watchlist),
    deltaSinceLastRun: cleanTextArray(brief.deltaSinceLastRun),
    selectedArticles: cleanSelectedArticles(brief.selectedArticles),
    marketIndicators: cleanIndicators(brief.marketIndicators),
    vpSnapshot: cleanVpSnapshot(brief.vpSnapshot),
    cmSnapshot: cleanCmSnapshot(brief.cmSnapshot),
    decisionSummary: cleanDecisionSummary(brief.decisionSummary),
    claims,
    sources
  };

  return {
    brief: cleanedBrief,
    claims,
    sources,
    issues,
    stats: {
      supported,
      analysis,
      needsVerification,
      total: claims.length
    }
  };
}

export function attachEvidenceToBrief(params: {
  brief: BriefPost;
  articles: ArticleInput[];
  nowIso?: string;
}): EvidenceResult {
  const nowIso = params.nowIso ?? new Date().toISOString();
  const corpus: EvidenceCorpusEntry[] = params.articles.map((article, idx) => ({
    index: idx + 1,
    url: article.url,
    title: article.title,
    content: article.content,
    publishedAt: article.publishedAt,
    contentStatus: article.contentStatus
  }));
  return buildClaims({ brief: params.brief, corpus, parseKind: "article", nowIso });
}

export function attachEvidenceToMarketBrief(params: {
  brief: BriefPost;
  candidates: MarketCandidate[];
  nowIso?: string;
}): EvidenceResult {
  const nowIso = params.nowIso ?? new Date().toISOString();
  const corpus: EvidenceCorpusEntry[] = params.candidates.map((candidate, idx) => ({
    index: idx + 1,
    url: candidate.url,
    title: candidate.title,
    content: candidate.briefContent,
    publishedAt: nowIso
  }));
  return buildClaims({ brief: params.brief, corpus, parseKind: "candidate", nowIso });
}

export type { EvidenceResult };
