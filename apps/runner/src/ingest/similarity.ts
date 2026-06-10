/**
 * Lightweight title similarity for cross-day story threading.
 *
 * Two outlets covering the same contract award produce different URLs but
 * near-identical headlines. URL dedup misses those; token-set similarity
 * catches them so yesterday's story doesn't resurface as "new" today.
 */

const STOPWORDS = new Set([
  "a", "an", "and", "as", "at", "be", "by", "for", "from", "has", "have",
  "in", "into", "is", "it", "its", "of", "on", "or", "over", "say", "says",
  "that", "the", "their", "this", "to", "up", "was", "were", "will", "with",
  "after", "amid", "new", "more"
]);

export function titleTokens(title: string): Set<string> {
  const tokens = (title ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
  return new Set(tokens);
}

export function tokenSetSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }
  // Overlap coefficient (intersection over the smaller set) is more robust
  // than Jaccard for headlines of different lengths covering the same event.
  return intersection / Math.min(a.size, b.size);
}

export const NEAR_DUPLICATE_THRESHOLD = 0.6;

/**
 * Returns true when a candidate title is a near-duplicate of any recent
 * title — i.e. very likely the same story from another outlet or a re-run.
 */
export function isNearDuplicateTitle(
  title: string,
  recentTitleTokenSets: Array<Set<string>>,
  threshold: number = NEAR_DUPLICATE_THRESHOLD
): boolean {
  const candidate = titleTokens(title);
  if (candidate.size === 0) return false;
  return recentTitleTokenSets.some((recent) => tokenSetSimilarity(candidate, recent) >= threshold);
}
