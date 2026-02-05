const ENTITY_MAP: Record<string, string> = {
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
  "fbclid"
]);

const GOOGLE_HOSTS = new Set([
  "news.google.com",
  "www.news.google.com",
  "google.com",
  "www.google.com"
]);

const resolvedUrlCache = new Map<string, string>();

function decodeNumericEntity(entity: string): string {
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
  let output = input || "";
  for (const [entity, value] of Object.entries(ENTITY_MAP)) {
    output = output.split(entity).join(value);
  }
  return output.replace(/&#(x?[0-9a-fA-F]+);/g, (_, entity) => decodeNumericEntity(entity));
}

export function cleanText(input: string): string {
  return decodeHtmlEntities(input)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isGoogleHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (GOOGLE_HOSTS.has(host)) return true;
  return host.endsWith(".google.com");
}

function directGoogleTarget(url: URL): string | undefined {
  const direct =
    url.searchParams.get("url") ||
    url.searchParams.get("u") ||
    url.searchParams.get("q") ||
    url.searchParams.get("target");
  if (!direct) return undefined;
  try {
    return decodeURIComponent(direct);
  } catch {
    return direct;
  }
}

export function canonicalizeUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl.trim());
    if (isGoogleHost(parsed.hostname)) {
      const direct = directGoogleTarget(parsed);
      if (direct) {
        return canonicalizeUrl(direct);
      }
    }
    for (const key of TRACKING_PARAMS) {
      parsed.searchParams.delete(key);
    }
    parsed.hash = "";
    if (parsed.pathname.endsWith("/") && parsed.pathname !== "/") {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    return parsed.toString();
  } catch {
    return rawUrl.trim();
  }
}

async function resolveRedirects(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6_000);
  try {
    let current = url;
    for (let i = 0; i < 3; i += 1) {
      const response = await fetch(current, {
        method: "HEAD",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; ProofOfConceptStudio/1.0)",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        }
      }).catch(() =>
        fetch(current, {
          method: "GET",
          redirect: "manual",
          signal: controller.signal,
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; ProofOfConceptStudio/1.0)",
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
          }
        })
      );
      if (!response) return canonicalizeUrl(current);
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
    clearTimeout(timeout);
  }
}

export async function resolvePublisherUrl(rawUrl: string): Promise<string> {
  const initial = canonicalizeUrl(rawUrl);
  if (!initial) return rawUrl;
  if (resolvedUrlCache.has(initial)) return resolvedUrlCache.get(initial)!;

  let resolved = initial;
  try {
    const parsed = new URL(initial);
    if (isGoogleHost(parsed.hostname)) {
      resolved = await resolveRedirects(initial);
    }
  } catch {
    resolved = initial;
  }

  resolvedUrlCache.set(initial, resolved);
  return resolved;
}
