const TRACKING_PARAMS = ["fbclid", "gclid", "mc_cid", "mc_eid"];

/**
 * Normalizes URLs for deduplication across runs.
 */
export function normalizeForDedupe(rawUrl: string): string | null {
  if (!rawUrl) return null;
  try {
    const url = new URL(rawUrl);
    url.hash = "";
    url.hostname = url.hostname.replace(/^www\./, "").toLowerCase();

    for (const param of Array.from(url.searchParams.keys())) {
      if (param.startsWith("utm_")) {
        url.searchParams.delete(param);
      }
      if (TRACKING_PARAMS.includes(param.toLowerCase())) {
        url.searchParams.delete(param);
      }
    }

    // Remove trailing slash
    const normalized = url.toString().replace(/\/+$/, "");
    return normalized;
  } catch {
    return null;
  }
}
