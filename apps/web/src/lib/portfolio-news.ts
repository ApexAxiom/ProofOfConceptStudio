import { getGoogleNewsFeeds, getPortfolioSources } from "@proof/shared";

export interface PortfolioNewsArticle {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  summary?: string;
  region: "APAC" | "INTL";
}

const FEED_TIMEOUT_MS = 8_000;
const MAX_FEEDS_PER_REGION = 6;
const MAX_ITEMS_PER_FEED = 5;
const MAX_AGE_DAYS = 7;

function parseTag(item: string, tag: string): string | null {
  const cdata = item.match(new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, "i"));
  if (cdata?.[1]) return cdata[1].trim();
  const plain = item.match(new RegExp(`<${tag}>([^<]*)<\\/${tag}>`, "i"));
  return plain?.[1]?.trim() ?? null;
}

function normalizeSummary(text?: string): string | undefined {
  if (!text) return undefined;
  const clean = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return clean.length ? clean.slice(0, 180) : undefined;
}

function isFresh(iso: string): boolean {
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts <= MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
}

async function fetchFeed(url: string, region: "APAC" | "INTL", sourceName: string): Promise<PortfolioNewsArticle[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FEED_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ProofOfConceptStudio/1.0)"
      },
      next: { revalidate: 3_600 }
    });
    if (!response.ok) return [];

    const xml = await response.text();
    const matches = Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)).slice(0, MAX_ITEMS_PER_FEED);
    const articles: PortfolioNewsArticle[] = [];

    for (const match of matches) {
      const item = match[1];
      const title = parseTag(item, "title");
      const link = parseTag(item, "link");
      const pubDate = parseTag(item, "pubDate");
      const description = parseTag(item, "description");
      if (!title || !link) continue;
      const publishedAt = pubDate ? new Date(pubDate).toISOString() : new Date().toISOString();
      if (!isFresh(publishedAt)) continue;
      articles.push({
        title: title.replace(/\s+/g, " ").trim(),
        url: link,
        source: sourceName,
        publishedAt,
        summary: normalizeSummary(description),
        region
      });
    }

    return articles;
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

function dedupeArticles(items: PortfolioNewsArticle[]): PortfolioNewsArticle[] {
  const seen = new Set<string>();
  const result: PortfolioNewsArticle[] = [];
  for (const item of items) {
    const key = `${item.url.toLowerCase()}::${item.title.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function feedUrls(portfolio: string, region: "apac" | "intl"): Array<{ url: string; source: string }> {
  const base = getPortfolioSources(portfolio, region)
    .map((source) => ({
      url: source.rssUrl ?? source.url,
      source: source.name
    }))
    .filter((entry) => entry.url.includes("rss") || entry.url.includes("/feed"));
  const google = getGoogleNewsFeeds(portfolio, region).map((source) => ({
    url: source.rssUrl ?? source.url,
    source: source.name
  }));

  return [...base, ...google].slice(0, MAX_FEEDS_PER_REGION);
}

export async function getPortfolioNews(portfolio: string, limit = 12): Promise<PortfolioNewsArticle[]> {
  const apacFeeds = feedUrls(portfolio, "apac");
  const intlFeeds = feedUrls(portfolio, "intl");

  const [apacArticles, intlArticles] = await Promise.all([
    Promise.all(apacFeeds.map((feed) => fetchFeed(feed.url, "APAC", feed.source))).then((list) => list.flat()),
    Promise.all(intlFeeds.map((feed) => fetchFeed(feed.url, "INTL", feed.source))).then((list) => list.flat())
  ]);

  return dedupeArticles([...apacArticles, ...intlArticles])
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, limit);
}

