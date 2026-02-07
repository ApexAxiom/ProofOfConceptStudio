const COMMON_ENTITY_MAP: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": "\"",
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " "
};

const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "fbclid",
  "ocid",
  "mkt_tok"
]);

const GOOGLE_HOSTS = new Set([
  "news.google.com",
  "www.news.google.com",
  "google.com",
  "www.google.com"
]);

const resolvedUrlCache = new Map<string, string>();

function decodeHtmlNumericEntity(entity: string): string {
  const hex = entity.toLowerCase().startsWith("x");
  const raw = hex ? entity.slice(1) : entity;
  const codePoint = Number.parseInt(raw, hex ? 16 : 10);
  if (!Number.isFinite(codePoint) || codePoint <= 0) return "";
  try {
    return String.fromCodePoint(codePoint);
  } catch {
    return "";
  }
}

export function decodeHtmlEntities(input: string): string {
  if (!input) return "";
  let output = input;

  for (const [entity, value] of Object.entries(COMMON_ENTITY_MAP)) {
    output = output.split(entity).join(value);
  }

  output = output.replace(/&#(x?[0-9a-fA-F]+);/g, (_, entity) => decodeHtmlNumericEntity(entity));
  return output;
}

export function stripHtmlTags(input: string): string {
  return input.replace(/<[^>]*>/g, " ");
}

export function normalizeWhitespace(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

export function cleanText(input: string): string {
  return normalizeWhitespace(stripHtmlTags(decodeHtmlEntities(input || "")));
}

export function extractDomain(url: string): string | undefined {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

function isGoogleHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (GOOGLE_HOSTS.has(host)) return true;
  return host.endsWith(".google.com");
}

function normalizeGoogleTarget(url: URL): string | undefined {
  const direct =
    url.searchParams.get("url") ||
    url.searchParams.get("u") ||
    url.searchParams.get("q") ||
    url.searchParams.get("target");
  if (!direct) return undefined;
  try {
    return canonicalizeUrl(decodeURIComponent(direct));
  } catch {
    return canonicalizeUrl(direct);
  }
}

export function canonicalizeUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);

    // Some feeds embed the actual destination in query params.
    if (isGoogleHost(parsed.hostname)) {
      const direct = normalizeGoogleTarget(parsed);
      if (direct) return direct;
    }

    for (const key of TRACKING_PARAMS) {
      parsed.searchParams.delete(key);
    }

    if (parsed.pathname.endsWith("/") && parsed.pathname !== "/") {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }

    parsed.hash = "";
    return parsed.toString();
  } catch {
    return rawUrl.trim();
  }
}

async function resolveManualRedirect(url: string): Promise<string> {
  const controller = new AbortController();
  // Reduced timeout: 3s per resolution (was 5s). Avoids cascading timeouts.
  const timer = setTimeout(() => controller.abort(), 3_000);
  try {
    let current = url;
    // Only follow up to 2 hops (was 3) to keep resolution fast.
    for (let i = 0; i < 2; i += 1) {
      let response: Response;
      try {
        response = await fetch(current, {
          method: "HEAD",
          redirect: "manual",
          signal: controller.signal,
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; ProofOfConceptStudio/1.0)",
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
          }
        });
      } catch {
        // HEAD failed, try GET as fallback
        try {
          response = await fetch(current, {
            method: "GET",
            redirect: "manual",
            signal: controller.signal,
            headers: {
              "User-Agent": "Mozilla/5.0 (compatible; ProofOfConceptStudio/1.0)",
              Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
            }
          });
        } catch {
          // Both methods failed — return what we have
          return canonicalizeUrl(current);
        }
      }

      const location = response.headers.get("location");
      if (!location || response.status < 300 || response.status > 399) {
        return canonicalizeUrl(current);
      }
      current = new URL(location, current).toString();
    }
    return canonicalizeUrl(current);
  } catch {
    return canonicalizeUrl(url);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolves a publisher URL from a Google News redirect.
 * Returns the canonicalized URL immediately if resolution fails or times out.
 * Resolution is best-effort and never blocks the pipeline.
 */
export async function resolvePublisherUrl(rawUrl: string): Promise<string> {
  const initial = canonicalizeUrl(rawUrl);
  if (!initial) return rawUrl;
  if (resolvedUrlCache.has(initial)) {
    return resolvedUrlCache.get(initial)!;
  }

  let resolved = initial;
  try {
    const parsed = new URL(initial);
    if (isGoogleHost(parsed.hostname)) {
      // First, try to extract the destination from the URL query params (no network call needed).
      const directTarget = normalizeGoogleTarget(parsed);
      if (directTarget && !isGoogleHost(new URL(directTarget).hostname)) {
        resolved = directTarget;
      } else {
        // Network resolution as a fallback — wrapped in a short timeout.
        resolved = await resolveManualRedirect(initial);
      }
    }
  } catch {
    resolved = initial;
  }

  resolvedUrlCache.set(initial, resolved);
  return resolved;
}

function titleFingerprint(title: string): string {
  return normalizeWhitespace(
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(" ")
      .filter((token) => token.length > 2)
      .slice(0, 12)
      .join(" ")
  );
}

export function splitPublisherFromTitle(rawTitle: string): { title: string; publisher?: string } {
  const cleaned = cleanText(rawTitle);
  if (!cleaned) return { title: "" };
  const parts = cleaned.split(" - ").map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const trailing = parts[parts.length - 1];
    if (trailing.length > 1 && trailing.length <= 45 && trailing.split(" ").length <= 6) {
      return {
        title: parts.slice(0, -1).join(" - "),
        publisher: trailing
      };
    }
  }
  return { title: cleaned };
}

export function dedupeNewsItems<T extends { url: string; title: string }>(items: T[]): T[] {
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();
  const output: T[] = [];

  for (const item of items) {
    const normalizedUrl = canonicalizeUrl(item.url).toLowerCase();
    const normalizedTitle = titleFingerprint(item.title);
    if (seenUrls.has(normalizedUrl)) continue;
    if (normalizedTitle && seenTitles.has(normalizedTitle)) continue;
    seenUrls.add(normalizedUrl);
    if (normalizedTitle) seenTitles.add(normalizedTitle);
    output.push(item);
  }

  return output;
}

export function isLikelyJunkText(input: string): boolean {
  const text = cleanText(input).toLowerCase();
  if (!text) return true;
  if (text.includes("href=") || text.includes("news.google.com/rss/articles")) return true;
  return false;
}
