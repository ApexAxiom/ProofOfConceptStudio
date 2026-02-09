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
// Structured report markdown adds numeric footnote-style citations like [1][2].
// Treat these as citations, not numeric claims.
const BRACKET_CITATION_STRIP_REGEX = /\s*\[\d+\]\s*/g;
const BRACKET_CITATION_DETECT_REGEX = /\[\d+\]/;
const NUMERIC_TOKEN_REGEX =
  /\bQ[1-4]\s?\d{4}\b|[$€£¥]\s?\d[\d,]*(?:\.\d+)?(?:\/[a-z]+)?|\d[\d,]*(?:\.\d+)?%|\b\d+(?:\.\d+)?\s?(?:million|billion|trillion|mbpd|kb\/d|bpd|mt|mmbtu|bbl|boe|tcf|bcf|tons?|tonnes?|kg|mw|gw|kb|mb|gb|tb)\b|\b\d[\d,]*(?:\.\d+)?\b/gi;

export function stripEvidenceTag(text: string): string {
  return text
    .replace(BRACKET_CITATION_STRIP_REGEX, " ")
    .replace(SOURCE_TAG_REGEX, "")
    .replace(MARKET_SOURCE_TAG_REGEX, "")
    .replace(ANALYSIS_TAG_REGEX, "")
    .replace(/\s+/g, " ")
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

function hasBracketCitations(text: string): boolean {
  return BRACKET_CITATION_DETECT_REGEX.test(text);
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

  const checkGenericString = (path: string, text: string, requireEvidence: boolean = false) => {
    const cited = hasBracketCitations(text);
    const tokens = extractNumericTokens(text);
    if (tokens.length === 0) return;

    const tag = parseEvidenceTag(text);
    if (tag.kind === "analysis") {
      // Allow analysis tags with numbers for summaries/highlights (general analysis)
      // Only flag if this is a section that requires evidence
      if (requireEvidence) {
        recordIssue(
          `${path} is labeled (analysis) but contains numeric tokens (${tokens.join(", ")}). (approximate match allowed).`
        );
      }
      return;
    }

    if (tag.kind === "source") {
      const content = contentByIndex.get(tag.articleIndex) ?? "";
      // Allow approximate matches - check if tokens are reasonably close
      if (!contentContainsAllTokens(tokens, content)) {
        // Numeric token matching is best-effort; treat mismatches as warnings.
        recordIssue(
          `${path} contains '${tokens.join(", ")}' but not found exactly in articleIndex ${tag.articleIndex} content (approximate match allowed).`
        );
      }
      return;
    }

    // Only require evidence tags for critical sections
    if (requireEvidence) {
      // Structured report output uses [n] citations instead of (source: articleIndex N).
      // Require some form of attribution, but don't block on token-by-token matching for actionables.
      if (!cited) {
        recordIssue(`${path} has numbers but is missing a citation or evidence tag.`);
      } else if (!anyContentContainsTokens(tokens, selectedContents)) {
        recordIssue(
          `${path} contains '${tokens.join(", ")}' but not found in selected article content (approximate match allowed).`
        );
      }
    }
    // For non-critical sections (summary, highlights), allow numbers without evidence tags
  };

  const checkEvidenceString = (path: string, text: string, evidenceIndex?: number) => {
    const tokens = extractNumericTokens(text);
    if (tokens.length === 0) return;

    const tag = parseEvidenceTag(text);

    // Prefer an explicit trailing (source: articleIndex N) tag, but if the field already carries an evidenceIndex
    // (e.g. selectedArticles.sourceIndex, vpSnapshot.evidenceArticleIndex), treat that as the attribution anchor.
    const effectiveIndex =
      tag.kind === "source"
        ? tag.articleIndex
        : typeof evidenceIndex === "number" && Number.isInteger(evidenceIndex)
          ? evidenceIndex
          : undefined;

    if (!effectiveIndex) {
      // No clear attribution anchor; allow as analyst interpretation.
      return;
    }

    const content = contentByIndex.get(effectiveIndex) ?? "";
    if (!contentContainsAllTokens(tokens, content)) {
      recordIssue(
        `${path} contains '${tokens.join(", ")}' but not found exactly in articleIndex ${effectiveIndex} content (approximate match allowed).`
      );
    }
  };

  // Summary and highlights: Allow numbers without evidence tags (general analysis/aggregation)
  if (brief.summary) {
    checkGenericString("summary", brief.summary, false);
  }

  (brief.highlights ?? []).forEach((item, idx) => checkGenericString(`highlights[${idx}]`, item, false));
  
  // Procurement actions, watchlist: Require evidence tags (actionable items)
  (brief.procurementActions ?? []).forEach((item, idx) => checkGenericString(`procurementActions[${idx}]`, item, true));
  (brief.watchlist ?? []).forEach((item, idx) => checkGenericString(`watchlist[${idx}]`, item, true));
  
  // Delta: Allow analysis (trend statements)
  (brief.deltaSinceLastRun ?? []).forEach((item, idx) => checkGenericString(`deltaSinceLastRun[${idx}]`, item, false));

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
    // Health narrative: Allow analysis (general assessment)
    if (snapshot.health?.narrative) {
      checkGenericString("vpSnapshot.health.narrative", snapshot.health.narrative, false);
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
    // Intel gaps and talking points: Allow analysis (general statements)
    (snapshot.intelGaps ?? []).forEach((item, idx) => checkGenericString(`cmSnapshot.intelGaps[${idx}]`, item, false));
    (snapshot.talkingPoints ?? []).forEach((item, idx) => checkGenericString(`cmSnapshot.talkingPoints[${idx}]`, item, false));
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

  const checkMarketString = (path: string, text: string, requireEvidence: boolean = false) => {
    const tokens = extractNumericTokens(text);
    if (tokens.length === 0) return;

    const tag = parseMarketEvidenceTag(text);
    if (tag.kind === "analysis") {
      // Allow analysis tags with numbers for market dashboard (general analysis)
      if (requireEvidence) {
        recordIssue(`${path} is labeled (analysis) but contains numeric tokens (${tokens.join(", ")}).`);
      }
      return;
    }

    if (tag.kind === "source") {
      const content = contentByIndex.get(tag.candidateIndex) ?? "";
      // Allow approximate matches
      if (!contentContainsAllTokens(tokens, content)) {
        if (requireEvidence) {
          recordIssue(`${path} contains '${tokens.join(", ")}' but not found in candidateIndex ${tag.candidateIndex} content.`);
        }
      }
      return;
    }

    // Only require evidence tags for critical sections
    if (requireEvidence) {
      recordIssue(`${path} has numbers but is missing an evidence tag.`);
      if (!anyContentContainsTokens(tokens, selectedContents)) {
        recordIssue(`${path} contains '${tokens.join(", ")}' but not found in selected candidate content.`);
      }
    }
  };

  // Market dashboard: Allow numbers in summary/highlights without evidence tags
  if (brief.summary) {
    checkMarketString("summary", brief.summary, false);
  }

  (brief.highlights ?? []).forEach((item, idx) => checkMarketString(`highlights[${idx}]`, item, false));
  
  // Procurement actions and watchlist: Require evidence tags
  (brief.procurementActions ?? []).forEach((item, idx) => checkMarketString(`procurementActions[${idx}]`, item, true));
  (brief.watchlist ?? []).forEach((item, idx) => checkMarketString(`watchlist[${idx}]`, item, true));
  return issues;
}
