import { BriefPost } from "@proof/shared";
import type { ArticleInput } from "../llm/prompts.js";
import { MarketCandidate } from "../llm/market-prompts.js";

type EvidenceTag =
  | { kind: "source"; articleIndex: number }
  | { kind: "analysis" }
  | { kind: "none" };

type MarketEvidenceTag =
  | { kind: "source"; candidateIndex: number }
  | { kind: "analysis" }
  | { kind: "none" };

const SOURCE_TAG_REGEX = /\(source:\s*(?:articleIndex\s*)?(\d+)\)\s*$/i;
const MARKET_SOURCE_TAG_REGEX = /\(source:\s*(?:candidateIndex\s*)?(\d+)\)\s*$/i;
const ANALYSIS_TAG_REGEX = /\(analysis\)\s*$/i;
const NUMERIC_TOKEN_REGEX =
  /\bQ[1-4]\s?\d{4}\b|[$€£¥]\s?\d[\d,]*(?:\.\d+)?(?:\/[a-z]+)?|\d[\d,]*(?:\.\d+)?%|\b\d+(?:\.\d+)?\s?(?:million|billion|trillion|mbpd|kb\/d|bpd|mt|mmbtu|bbl|boe|tcf|bcf|tons?|tonnes?|kg|mw|gw|kb|mb|gb|tb)\b|\b\d[\d,]*(?:\.\d+)?\b/gi;

export function stripEvidenceTag(text: string): string {
  return text
    .replace(SOURCE_TAG_REGEX, "")
    .replace(MARKET_SOURCE_TAG_REGEX, "")
    .replace(ANALYSIS_TAG_REGEX, "")
    .trim();
}

/**
 * Extract numeric tokens from a string, ignoring evidence tags.
 */
export function extractNumericTokens(text: string): string[] {
  const stripped = stripEvidenceTag(text);
  const matches = stripped.match(NUMERIC_TOKEN_REGEX) ?? [];
  const tokens = new Set(matches.map((m) => m.trim()).filter(Boolean));
  return Array.from(tokens);
}

/**
 * Parse a trailing evidence tag for articleIndex or analysis.
 */
export function parseEvidenceTag(text: string): EvidenceTag {
  const analysisMatch = text.match(ANALYSIS_TAG_REGEX);
  if (analysisMatch) {
    return { kind: "analysis" };
  }

  const sourceMatch = text.match(SOURCE_TAG_REGEX);
  if (sourceMatch) {
    return { kind: "source", articleIndex: Number(sourceMatch[1]) };
  }

  return { kind: "none" };
}

/**
 * Normalize text for token matching.
 */
export function normalizeForMatch(text: string): string {
  return text.toLowerCase().replace(/,/g, "").replace(/\s+/g, " ").trim();
}

/**
 * Check whether all tokens appear in the provided content.
 */
export function contentContainsAllTokens(tokens: string[], content: string): boolean {
  if (tokens.length === 0) return true;
  const normalizedContent = normalizeForMatch(content);
  return tokens.every((token) => normalizedContent.includes(normalizeForMatch(token)));
}

export function parseMarketEvidenceTag(text: string): MarketEvidenceTag {
  const analysisMatch = text.match(ANALYSIS_TAG_REGEX);
  if (analysisMatch) {
    return { kind: "analysis" };
  }

  const sourceMatch = text.match(MARKET_SOURCE_TAG_REGEX);
  if (sourceMatch) {
    return { kind: "source", candidateIndex: Number(sourceMatch[1]) };
  }

  return { kind: "none" };
}

function anyContentContainsTokens(tokens: string[], contents: string[]): boolean {
  return contents.some((content) => contentContainsAllTokens(tokens, content));
}

/**
 * Validate numeric claims in a brief against article content.
 */
export function validateNumericClaims(brief: BriefPost, articleInputs: ArticleInput[]): string[] {
  const issues: string[] = [];
  const contentByIndex = new Map<number, string>();
  const selectedIndices = new Set<number>();

  articleInputs.forEach((article, idx) => {
    contentByIndex.set(idx + 1, article.content ?? "");
  });

  for (const article of brief.selectedArticles ?? []) {
    const index = Number((article as { sourceIndex?: number }).sourceIndex);
    if (Number.isInteger(index)) {
      selectedIndices.add(index);
    }
  }

  const selectedContents = selectedIndices.size
    ? Array.from(selectedIndices).map((idx) => contentByIndex.get(idx) ?? "")
    : Array.from(contentByIndex.values());

  const recordIssue = (message: string) => {
    issues.push(`FACTCHECK: ${message}`);
  };

  const checkGenericString = (path: string, text: string) => {
    const tokens = extractNumericTokens(text);
    if (tokens.length === 0) return;

    const tag = parseEvidenceTag(text);
    if (tag.kind === "analysis") {
      recordIssue(`${path} is labeled (analysis) but contains numeric tokens (${tokens.join(", ")}).`);
      return;
    }

    if (tag.kind === "source") {
      const content = contentByIndex.get(tag.articleIndex) ?? "";
      if (!contentContainsAllTokens(tokens, content)) {
        recordIssue(`${path} contains '${tokens.join(", ")}' but not found in articleIndex ${tag.articleIndex} content.`);
      }
      return;
    }

    recordIssue(`${path} has numbers but is missing an evidence tag.`);
    if (!anyContentContainsTokens(tokens, selectedContents)) {
      recordIssue(`${path} contains '${tokens.join(", ")}' but not found in selected article content.`);
    }
  };

  const checkEvidenceString = (path: string, text: string, evidenceIndex?: number) => {
    const tokens = extractNumericTokens(text);
    if (tokens.length === 0) return;

    const tag = parseEvidenceTag(text);
    if (tag.kind === "analysis") {
      recordIssue(`${path} is labeled (analysis) but contains numeric tokens (${tokens.join(", ")}).`);
      return;
    }

    if (tag.kind === "source") {
      if (typeof evidenceIndex === "number" && Number.isInteger(evidenceIndex) && tag.articleIndex !== evidenceIndex) {
        recordIssue(`${path} uses articleIndex ${tag.articleIndex} but evidenceArticleIndex is ${evidenceIndex}.`);
      }
      const content = contentByIndex.get(tag.articleIndex) ?? "";
      if (!contentContainsAllTokens(tokens, content)) {
        recordIssue(`${path} contains '${tokens.join(", ")}' but not found in articleIndex ${tag.articleIndex} content.`);
      }
      return;
    }

    recordIssue(`${path} has numbers but is missing an evidence tag.`);
    if (typeof evidenceIndex === "number" && Number.isInteger(evidenceIndex)) {
      const content = contentByIndex.get(evidenceIndex) ?? "";
      if (!contentContainsAllTokens(tokens, content)) {
        recordIssue(`${path} contains '${tokens.join(", ")}' but not found in articleIndex ${evidenceIndex} content.`);
      }
    } else if (!anyContentContainsTokens(tokens, selectedContents)) {
      recordIssue(`${path} contains '${tokens.join(", ")}' but not found in selected article content.`);
    }
  };

  if (brief.summary) {
    checkGenericString("summary", brief.summary);
  }

  (brief.highlights ?? []).forEach((item, idx) => checkGenericString(`highlights[${idx}]`, item));
  (brief.procurementActions ?? []).forEach((item, idx) => checkGenericString(`procurementActions[${idx}]`, item));
  (brief.watchlist ?? []).forEach((item, idx) => checkGenericString(`watchlist[${idx}]`, item));
  (brief.deltaSinceLastRun ?? []).forEach((item, idx) => checkGenericString(`deltaSinceLastRun[${idx}]`, item));

  (brief.selectedArticles ?? []).forEach((article, idx) => {
    const sourceIndex = Number((article as { sourceIndex?: number }).sourceIndex);
    if (article.briefContent) {
      checkEvidenceString(`selectedArticles[${idx}].briefContent`, article.briefContent, sourceIndex);
    }
    if (article.categoryImportance) {
      checkEvidenceString(`selectedArticles[${idx}].categoryImportance`, article.categoryImportance, sourceIndex);
    }
    (article.keyMetrics ?? []).forEach((metric, metricIdx) =>
      checkEvidenceString(`selectedArticles[${idx}].keyMetrics[${metricIdx}]`, metric, sourceIndex)
    );
  });

  if (brief.vpSnapshot) {
    const snapshot = brief.vpSnapshot;
    if (snapshot.health?.narrative) {
      checkGenericString("vpSnapshot.health.narrative", snapshot.health.narrative);
    }
    (snapshot.topSignals ?? []).forEach((signal, idx) => {
      checkEvidenceString(`vpSnapshot.topSignals[${idx}].title`, signal.title, signal.evidenceArticleIndex);
      checkEvidenceString(`vpSnapshot.topSignals[${idx}].impact`, signal.impact, signal.evidenceArticleIndex);
    });
    (snapshot.recommendedActions ?? []).forEach((action, idx) => {
      checkEvidenceString(
        `vpSnapshot.recommendedActions[${idx}].action`,
        action.action,
        action.evidenceArticleIndex
      );
      checkEvidenceString(
        `vpSnapshot.recommendedActions[${idx}].expectedImpact`,
        action.expectedImpact,
        action.evidenceArticleIndex
      );
    });
    (snapshot.riskRegister ?? []).forEach((risk, idx) => {
      checkEvidenceString(`vpSnapshot.riskRegister[${idx}].risk`, risk.risk, risk.evidenceArticleIndex);
      checkEvidenceString(`vpSnapshot.riskRegister[${idx}].mitigation`, risk.mitigation, risk.evidenceArticleIndex);
      checkEvidenceString(`vpSnapshot.riskRegister[${idx}].trigger`, risk.trigger, risk.evidenceArticleIndex);
    });
  }

  if (brief.cmSnapshot) {
    const snapshot = brief.cmSnapshot;
    (snapshot.todayPriorities ?? []).forEach((item, idx) => {
      checkEvidenceString(`cmSnapshot.todayPriorities[${idx}].title`, item.title, item.evidenceArticleIndex);
      checkEvidenceString(`cmSnapshot.todayPriorities[${idx}].why`, item.why, item.evidenceArticleIndex);
    });
    (snapshot.supplierRadar ?? []).forEach((item, idx) => {
      checkEvidenceString(`cmSnapshot.supplierRadar[${idx}].supplier`, item.supplier, item.evidenceArticleIndex);
      checkEvidenceString(`cmSnapshot.supplierRadar[${idx}].signal`, item.signal, item.evidenceArticleIndex);
      checkEvidenceString(
        `cmSnapshot.supplierRadar[${idx}].implication`,
        item.implication,
        item.evidenceArticleIndex
      );
      checkEvidenceString(`cmSnapshot.supplierRadar[${idx}].nextStep`, item.nextStep, item.evidenceArticleIndex);
    });
    (snapshot.negotiationLevers ?? []).forEach((item, idx) => {
      checkEvidenceString(`cmSnapshot.negotiationLevers[${idx}].lever`, item.lever, item.evidenceArticleIndex);
      checkEvidenceString(`cmSnapshot.negotiationLevers[${idx}].whenToUse`, item.whenToUse, item.evidenceArticleIndex);
      checkEvidenceString(
        `cmSnapshot.negotiationLevers[${idx}].expectedOutcome`,
        item.expectedOutcome,
        item.evidenceArticleIndex
      );
    });
    (snapshot.intelGaps ?? []).forEach((item, idx) => checkGenericString(`cmSnapshot.intelGaps[${idx}]`, item));
    (snapshot.talkingPoints ?? []).forEach((item, idx) => checkGenericString(`cmSnapshot.talkingPoints[${idx}]`, item));
  }

  return issues;
}

/**
 * Validate numeric claims in a market dashboard brief against candidate summaries.
 */
export function validateMarketNumericClaims(brief: BriefPost, candidates: MarketCandidate[]): string[] {
  const issues: string[] = [];
  const contentByIndex = new Map<number, string>();

  candidates.forEach((candidate, idx) => {
    contentByIndex.set(idx + 1, candidate.briefContent ?? "");
  });

  const selectedIndices = new Set<number>();
  for (const article of brief.selectedArticles ?? []) {
    const index = Number((article as { sourceIndex?: number }).sourceIndex);
    if (Number.isInteger(index)) {
      selectedIndices.add(index);
    }
  }

  const selectedContents = selectedIndices.size
    ? Array.from(selectedIndices).map((idx) => contentByIndex.get(idx) ?? "")
    : Array.from(contentByIndex.values());

  const recordIssue = (message: string) => {
    issues.push(`FACTCHECK: ${message}`);
  };

  const checkMarketString = (path: string, text: string) => {
    const tokens = extractNumericTokens(text);
    if (tokens.length === 0) return;

    const tag = parseMarketEvidenceTag(text);
    if (tag.kind === "analysis") {
      recordIssue(`${path} is labeled (analysis) but contains numeric tokens (${tokens.join(", ")}).`);
      return;
    }

    if (tag.kind === "source") {
      const content = contentByIndex.get(tag.candidateIndex) ?? "";
      if (!contentContainsAllTokens(tokens, content)) {
        recordIssue(`${path} contains '${tokens.join(", ")}' but not found in candidateIndex ${tag.candidateIndex} content.`);
      }
      return;
    }

    recordIssue(`${path} has numbers but is missing an evidence tag.`);
    if (!anyContentContainsTokens(tokens, selectedContents)) {
      recordIssue(`${path} contains '${tokens.join(", ")}' but not found in selected candidate content.`);
    }
  };

  if (brief.summary) {
    checkMarketString("summary", brief.summary);
  }

  (brief.highlights ?? []).forEach((item, idx) => checkMarketString(`highlights[${idx}]`, item));
  (brief.procurementActions ?? []).forEach((item, idx) => checkMarketString(`procurementActions[${idx}]`, item));
  (brief.watchlist ?? []).forEach((item, idx) => checkMarketString(`watchlist[${idx}]`, item));
  return issues;
}
