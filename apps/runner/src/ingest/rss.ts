import { XMLParser } from "fast-xml-parser";
import { AgentFeed } from "@proof/shared";
import { request } from "undici";
import { cleanText, resolvePublisherUrl } from "./news-normalization.js";

// Browser-like headers to avoid 403/400 errors from RSS feeds
const RSS_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, */*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
};
const PROVIDER_COOLDOWN_MS = Number(process.env.GOOGLE_NEWS_COOLDOWN_MS ?? 30 * 60 * 1000);
const providerCooldownUntil = new Map<string, number>();

function hostForUrl(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

function isGoogleNewsHost(host: string | null): boolean {
  return host === "news.google.com";
}

function setProviderCooldown(host: string, reasonCode: string): void {
  const until = Date.now() + PROVIDER_COOLDOWN_MS;
  providerCooldownUntil.set(host, until);
  console.warn(
    JSON.stringify({
      level: "warn",
      event: "feed_provider_cooldown_started",
      reasonCode,
      host,
      cooldownMs: PROVIDER_COOLDOWN_MS,
      until: new Date(until).toISOString()
    })
  );
}

// Delay helper for retry backoff
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetches RSS feed with retry logic
 */
async function fetchRssWithRetry(feed: AgentFeed, maxRetries = 3): Promise<any[]> {
  let lastError: Error | undefined;
  const host = hostForUrl(feed.url);
  const cooldownUntil = host ? providerCooldownUntil.get(host) : undefined;
  if (host && cooldownUntil && cooldownUntil > Date.now()) {
    console.warn(
      JSON.stringify({
        level: "warn",
        event: "feed_provider_cooldown_skipped",
        reasonCode: "provider_temporarily_unavailable",
        host,
        feedName: feed.name,
        feedUrl: feed.url,
        until: new Date(cooldownUntil).toISOString()
      })
    );
    return [];
  }
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await request(feed.url, { 
        method: "GET",
        headers: RSS_HEADERS,
        maxRedirections: 5,
        bodyTimeout: 30000,
        headersTimeout: 15000,
      });
      
      if (res.statusCode >= 500) {
        // Server error - worth retrying
        console.warn(`RSS feed ${feed.name} returned ${res.statusCode}, attempt ${attempt}/${maxRetries}`);
        if (isGoogleNewsHost(host) && (res.statusCode === 503 || res.statusCode === 502 || res.statusCode === 504)) {
          setProviderCooldown(host!, "provider_http_5xx");
        }
        if (attempt < maxRetries) {
          await delay(1000 * attempt); // Exponential backoff
          continue;
        }
        return [];
      }
      
      if (res.statusCode >= 400) {
        // Client error - don't retry
        console.warn(`RSS feed ${feed.name} returned status ${res.statusCode}`);
        if (isGoogleNewsHost(host) && res.statusCode === 429) {
          setProviderCooldown(host!, "provider_rate_limited");
        }
        return [];
      }
      
      const text = await res.body.text();
      
      // Check if response looks like XML
      const trimmed = text.trim().toLowerCase();
      if (!trimmed.startsWith("<?xml") && !trimmed.startsWith("<rss") && !trimmed.startsWith("<feed")) {
        console.warn(`RSS feed ${feed.name} did not return valid XML`);
        return [];
      }
      
      const parser = new XMLParser({ ignoreAttributes: false });
      const parsed = parser.parse(text);
      const items = parsed.rss?.channel?.item ?? parsed.feed?.entry ?? [];
      
      // Handle single item (not array)
      const itemArray = Array.isArray(items) ? items : [items];
      
      const results = await Promise.all(
        itemArray.map(async (item: any) => {
          const rawTitle = item.title?._text || item.title || "";
          const rawLink = item.link?.["@_href"] || item.link?.href || item.link || item.guid || "";
          const title = cleanText(String(rawTitle || ""));
          if (!rawLink || typeof rawLink !== "string" || !title) return null;
          const resolvedLink = await resolvePublisherUrl(String(rawLink));
          return {
            title,
            link: resolvedLink,
            pubDate: item.pubDate || item.updated || item.published || item["dc:date"]
          };
        })
      );
      const filtered = results.filter((item): item is NonNullable<typeof item> => Boolean(item));
      
      if (filtered.length > 0) {
        console.log(`RSS feed ${feed.name} returned ${filtered.length} items`);
      }
      
      return filtered;
    } catch (err) {
      lastError = err as Error;
      console.warn(`RSS feed ${feed.name} attempt ${attempt}/${maxRetries} failed:`, (err as Error).message);
      if (isGoogleNewsHost(host) && attempt === maxRetries) {
        setProviderCooldown(host!, "provider_request_failed");
      }
      
      if (attempt < maxRetries) {
        await delay(1000 * attempt);
      }
    }
  }
  
  console.error(`Failed to fetch RSS feed ${feed.name} after ${maxRetries} attempts:`, lastError?.message);
  return [];
}

export async function fetchRss(feed: AgentFeed) {
  return fetchRssWithRetry(feed, 3);
}
