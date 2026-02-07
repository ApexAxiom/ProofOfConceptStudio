import { canonicalizeUrl } from "@proof/shared";

/**
 * Normalizes URLs for deduplication across runs.
 */
export function normalizeForDedupe(rawUrl: string): string | null {
  return canonicalizeUrl(rawUrl);
}
