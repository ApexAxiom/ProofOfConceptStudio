import { JSDOM } from "jsdom";
import { BROWSER_HEADERS } from "../ingest/extract.js";

const IMAGE_HINT_WORDS = ["hero", "featured", "cover", "main", "lead"];
const IMAGE_SKIP_WORDS = ["logo", "icon", "sprite", "ad", "banner", "pixel", "spacer", "tracking"];

function toAbsoluteUrl(candidate: string | null | undefined, pageUrl: string): string | null {
  if (!candidate) return null;
  try {
    const resolved = new URL(candidate, pageUrl);
    if (resolved.protocol === "http:") {
      resolved.protocol = "https:";
    }
    return resolved.toString();
  } catch {
    return null;
  }
}

function scoreCandidate(url: string): number {
  const lower = url.toLowerCase();
  let score = 0;
  if (/[./](jpg|jpeg|png|webp)(\?|$)/.test(lower)) score += 5;
  if (IMAGE_HINT_WORDS.some((w) => lower.includes(w))) score += 3;
  if (IMAGE_SKIP_WORDS.some((w) => lower.includes(w))) score -= 4;
  if (lower.includes("upload") || lower.includes("media")) score += 1;
  return score;
}

async function isImage(url: string): Promise<boolean> {
  try {
    const head = await fetch(url, { method: "HEAD", headers: BROWSER_HEADERS, redirect: "follow" });
    const contentType = head.headers.get("content-type");
    if (contentType?.startsWith("image/")) return true;
  } catch {
    // fall through
  }

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { ...BROWSER_HEADERS, Range: "bytes=0-0" },
      redirect: "follow"
    });
    const contentType = res.headers.get("content-type");
    return Boolean(contentType && contentType.startsWith("image/"));
  } catch {
    return false;
  }
}

function collectMetaContent(doc: Document, selectors: string[]): string[] {
  const results: string[] = [];
  for (const selector of selectors) {
    const el = doc.querySelector(selector);
    const content = el?.getAttribute("content");
    if (content) results.push(content);
  }
  return results;
}

export async function findImageFromPage(pageUrl: string): Promise<{ url: string; alt?: string } | null> {
  try {
    const res = await fetch(pageUrl, { headers: BROWSER_HEADERS, redirect: "follow" });
    const html = await res.text();
    const dom = new JSDOM(html, { url: pageUrl });
    const { document } = dom.window;

    const candidates: { url: string; alt?: string; score: number }[] = [];

    const metaImages = collectMetaContent(document, [
      'meta[property="og:image"]',
      'meta[property="og:image:url"]',
      'meta[property="og:image:secure_url"]',
      'meta[name="twitter:image"]',
      'meta[name="twitter:image:src"]'
    ]);
    for (const content of metaImages) {
      const resolved = toAbsoluteUrl(content, pageUrl);
      if (resolved) candidates.push({ url: resolved, score: scoreCandidate(resolved) + 5 });
    }

    const linkImage = document.querySelector('link[rel="image_src"]')?.getAttribute("href");
    const resolvedLink = toAbsoluteUrl(linkImage, pageUrl);
    if (resolvedLink) candidates.push({ url: resolvedLink, score: scoreCandidate(resolvedLink) + 2 });

    const imgSelectors = ["article img", "main img", ".post img", "img"];
    for (const selector of imgSelectors) {
      const nodes = Array.from(document.querySelectorAll(selector));
      for (const node of nodes) {
        const src = node.getAttribute("src") || node.getAttribute("data-src");
        const alt = node.getAttribute("alt") ?? undefined;
        const resolved = toAbsoluteUrl(src, pageUrl);
        if (!resolved) continue;
        candidates.push({ url: resolved, alt, score: scoreCandidate(resolved) + (alt ? 1 : 0) });
      }
      if (candidates.length > 12) break;
    }

    const scored = candidates
      .filter((c) => c.url.startsWith("https://"))
      .sort((a, b) => b.score - a.score);

    for (const candidate of scored) {
      if (await isImage(candidate.url)) {
        return { url: candidate.url, alt: candidate.alt };
      }
    }
  } catch (err) {
    console.error("image-scraper fetch failed", err);
  }
  return null;
}

async function bingFallback(query: string): Promise<{ url: string; alt?: string } | null> {
  const apiKey = process.env.BING_IMAGE_KEY || process.env.AZURE_BING_IMAGE_KEY;
  const endpoint = process.env.BING_IMAGE_ENDPOINT || "https://api.bing.microsoft.com/v7.0/images/search";
  if (!apiKey) return null;
  try {
    const res = await fetch(`${endpoint}?q=${encodeURIComponent(query)}&count=5`, {
      headers: { Ocp-Apim-Subscription-Key: apiKey }
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { value?: Array<{ contentUrl?: string; name?: string }> };
    const first = data.value?.find((v) => v.contentUrl);
    if (first?.contentUrl) {
      return { url: first.contentUrl, alt: first.name };
    }
  } catch (err) {
    console.error("bing image search failed", err);
  }
  return null;
}

export async function findBestImageFromSources(
  sources: { url: string; title?: string; publisher?: string }[]
): Promise<{ url: string; alt?: string; attribution?: string } | null> {
  for (const source of sources) {
    const hit = await findImageFromPage(source.url);
    if (hit) {
      return { ...hit, attribution: source.publisher ?? source.title };
    }
  }

  const queryParts = sources.map((s) => s.title).filter(Boolean);
  if (queryParts.length > 0) {
    const fallback = await bingFallback(queryParts.slice(0, 3).join(" "));
    if (fallback) return { ...fallback, attribution: sources[0]?.publisher };
  }

  return null;
}
