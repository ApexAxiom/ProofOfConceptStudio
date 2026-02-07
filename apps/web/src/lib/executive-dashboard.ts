import { getPortfolioSources, isUserVisiblePlaceholderArticle } from "@proof/shared";
import { getExecutiveMarketQuotes, MarketQuote } from "./market-data";
import {
  canonicalizeUrl,
  cleanText,
  dedupeNewsItems,
  extractDomain,
  isLikelyJunkText,
  resolvePublisherUrl,
  splitPublisherFromTitle
} from "./news-normalization";

export type ExecutiveRegion = "apac" | "international" | "woodside";

export interface ExecutiveArticle {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  category: string;
  region: ExecutiveRegion;
  summary?: string;
  imageUrl?: string;
  domain?: string;
}

export interface ExecutiveDashboardPayload {
  generatedAt: string;
  market: {
    quotes: MarketQuote[];
    source: "live" | "mixed" | "fallback";
    lastUpdated: string;
  };
  woodside: {
    articles: ExecutiveArticle[];
    lastUpdated: string;
    source: string;
  };
  apac: {
    articles: ExecutiveArticle[];
    lastUpdated: string;
    source: string;
  };
  international: {
    articles: ExecutiveArticle[];
    lastUpdated: string;
    source: string;
  };
}

interface RssFeed {
  url: string;
  source: string;
  category: string;
  region: ExecutiveRegion;
}

const FEED_TIMEOUT_MS = 12_000;
const MAX_ITEMS_PER_FEED = 8;
const SECTION_LIMIT = 12;
const MAX_ARTICLE_AGE_DAYS = 14;
const EXECUTIVE_GOOGLE_NEWS_ENABLED = (process.env.EXECUTIVE_GOOGLE_NEWS_ENABLED ?? "false").toLowerCase() === "true";

function toExecutiveFeeds(portfolio: string, region: "apac" | "intl", targetRegion: ExecutiveRegion): RssFeed[] {
  return getPortfolioSources(portfolio, region)
    .map((source) => source.rssUrl ?? source.url)
    .filter((url) => url.includes("rss") || url.includes("/feed"))
    .map((url) => ({
      url,
      source: "Portfolio Sources",
      category: "Oil & Gas",
      region: targetRegion
    }));
}

const WOODSIDE_FEEDS: RssFeed[] = [
  ...toExecutiveFeeds("market-dashboard", "apac", "woodside"),
  ...toExecutiveFeeds("market-dashboard", "intl", "woodside")
];

const APAC_FEEDS: RssFeed[] = toExecutiveFeeds("market-dashboard", "apac", "apac");

const INTERNATIONAL_FEEDS: RssFeed[] = toExecutiveFeeds("market-dashboard", "intl", "international");

const GOOGLE_WOODSIDE_FEEDS: RssFeed[] = [
  {
    url: "https://news.google.com/rss/search?q=Woodside%20Energy&hl=en-US&gl=US&ceid=US:en",
    source: "Market Sources",
    category: "Woodside",
    region: "woodside"
  }
];

const GOOGLE_APAC_FEEDS: RssFeed[] = [
  {
    url: "https://news.google.com/rss/search?q=oil%20gas%20APAC%20LNG&hl=en-AU&gl=AU&ceid=AU:en",
    source: "Market Sources",
    category: "Oil & Gas",
    region: "apac"
  }
];

const GOOGLE_INTERNATIONAL_FEEDS: RssFeed[] = [
  {
    url: "https://news.google.com/rss/search?q=oil%20gas%20LNG%20US%20Mexico%20Senegal&hl=en-US&gl=US&ceid=US:en",
    source: "Market Sources",
    category: "Oil & Gas",
    region: "international"
  }
];

// Broader keyword sets to capture more relevant articles.
// Articles only need to match ONE keyword to be included.
const APAC_KEYWORDS = ["apac", "australia", "perth", "asia", "lng", "offshore", "woodside", "santos", "nws", "scarborough", "gas", "oil"];
const INTERNATIONAL_KEYWORDS = ["us", "united states", "mexico", "senegal", "houston", "lng", "gulf", "gas", "oil", "permian", "energy", "crude"];

function parseTagValue(item: string, tag: string): string | null {
  const cdata = item.match(new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, "i"));
  if (cdata?.[1]) return cdata[1].trim();
  const plain = item.match(new RegExp(`<${tag}>([^<]*)<\\/${tag}>`, "i"));
  return plain?.[1]?.trim() ?? null;
}

function looksFresh(iso: string): boolean {
  const publishedAt = new Date(iso).getTime();
  if (!Number.isFinite(publishedAt)) return false;
  const maxAge = MAX_ARTICLE_AGE_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() - publishedAt <= maxAge;
}

function matchesKeywords(text: string, keywords: string[]): boolean {
  if (keywords.length === 0) return true;
  const haystack = text.toLowerCase();
  return keywords.some((keyword) => haystack.includes(keyword));
}

/**
 * Resolves a single article URL with a per-item timeout.
 * Returns the canonicalized raw URL if resolution fails.
 */
async function safeResolveUrl(rawUrl: string): Promise<string> {
  try {
    // Race resolution against a short per-item timeout
    const result = await Promise.race([
      resolvePublisherUrl(rawUrl),
      new Promise<string>((resolve) => setTimeout(() => resolve(canonicalizeUrl(rawUrl)), 3_000))
    ]);
    return result;
  } catch {
    return canonicalizeUrl(rawUrl);
  }
}

async function fetchRssFeed(feed: RssFeed): Promise<ExecutiveArticle[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FEED_TIMEOUT_MS);

  try {
    const response = await fetch(feed.url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ProofOfConceptStudio/1.0)",
        Accept: "application/rss+xml, application/xml, text/xml"
      },
      // Use cache: "no-store" to avoid caching failures.
      // The in-memory dedup and section limits handle freshness.
      cache: "no-store"
    });
    if (!response.ok) return [];

    const xml = await response.text();
    const itemMatches = Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)).slice(0, MAX_ITEMS_PER_FEED);
    const articleCandidates = await Promise.all(
      itemMatches.map(async (match): Promise<ExecutiveArticle | null> => {
        const item = match[1];
        const rawTitle = parseTagValue(item, "title");
        const rawLink = parseTagValue(item, "link");
        const pubDate = parseTagValue(item, "pubDate");
        const description = parseTagValue(item, "description");
        const imageMatch = item.match(/url="([^"]+\.(jpg|jpeg|png|webp)[^"]*)"/i);
        const publishedAt = pubDate ? new Date(pubDate).toISOString() : new Date().toISOString();

        if (!rawTitle || !rawLink || !looksFresh(publishedAt)) return null;

        // URL resolution is best-effort with per-item timeout
        const resolvedUrl = await safeResolveUrl(rawLink);
        const { title, publisher } = splitPublisherFromTitle(rawTitle);
        const cleanTitle = cleanText(title);
        if (!cleanTitle || isLikelyJunkText(cleanTitle)) return null;
        const domain = extractDomain(resolvedUrl);

        return {
          title: cleanTitle,
          url: resolvedUrl,
          source: publisher ?? domain ?? feed.source,
          publishedAt,
          category: feed.category,
          region: feed.region,
          summary: cleanText(description ?? "").slice(0, 180),
          imageUrl: imageMatch?.[1],
          domain
        };
      })
    );

    return articleCandidates.filter((article): article is ExecutiveArticle => Boolean(article));
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

async function collectSectionArticles(feeds: RssFeed[], keywords: string[]): Promise<ExecutiveArticle[]> {
  const buckets = await Promise.all(feeds.map((feed) => fetchRssFeed(feed)));
  const allArticles = dedupeNewsItems(buckets.flat())
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  // First pass: keyword-matched articles
  const matched = allArticles.filter((article) =>
    matchesKeywords(`${article.title} ${article.summary ?? ""}`, keywords)
  );

  // If keyword matching returns enough articles, use them.
  if (matched.length >= 3) {
    return matched.slice(0, SECTION_LIMIT);
  }

  // Otherwise, include all articles from the feeds (they were already configured
  // for the correct region, so they're relevant even without keyword overlap).
  return allArticles.slice(0, SECTION_LIMIT);
}

function sectionLastUpdated(articles: ExecutiveArticle[], fallback = new Date().toISOString()): string {
  if (articles.length === 0) return fallback;
  return articles
    .map((article) => article.publishedAt)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
}

/**
 * Builds the executive dashboard payload for the homepage and API route.
 */
export async function getExecutiveDashboardData(): Promise<ExecutiveDashboardPayload> {
  const woodsideFeeds = EXECUTIVE_GOOGLE_NEWS_ENABLED ? [...WOODSIDE_FEEDS, ...GOOGLE_WOODSIDE_FEEDS] : WOODSIDE_FEEDS;
  const apacFeeds = EXECUTIVE_GOOGLE_NEWS_ENABLED ? [...APAC_FEEDS, ...GOOGLE_APAC_FEEDS] : APAC_FEEDS;
  const internationalFeeds = EXECUTIVE_GOOGLE_NEWS_ENABLED
    ? [...INTERNATIONAL_FEEDS, ...GOOGLE_INTERNATIONAL_FEEDS]
    : INTERNATIONAL_FEEDS;

  const [market, woodsideLive, apacLive, internationalLive] = await Promise.all([
    getExecutiveMarketQuotes(),
    collectSectionArticles(woodsideFeeds, ["woodside", "scarborough", "sangomar", "lng"]),
    collectSectionArticles(apacFeeds, APAC_KEYWORDS),
    collectSectionArticles(internationalFeeds, INTERNATIONAL_KEYWORDS)
  ]);

  const woodsideArticles = woodsideLive.filter((article) => !isUserVisiblePlaceholderArticle(article));
  const apacArticles = apacLive.filter((article) => !isUserVisiblePlaceholderArticle(article));

  // Prevent duplication across APAC and International sections.
  const apacUrls = new Set(apacArticles.map((article) => article.url.toLowerCase()));
  const internationalArticles = internationalLive
    .filter((article) => !apacUrls.has(article.url.toLowerCase()))
    .filter((article) => !isUserVisiblePlaceholderArticle(article));

  const generatedAt = new Date().toISOString();

  return {
    generatedAt,
    market: {
      quotes: market.quotes,
      source: market.source,
      lastUpdated: market.generatedAt
    },
    woodside: {
      articles: woodsideArticles,
      lastUpdated: sectionLastUpdated(woodsideArticles, generatedAt),
      source: EXECUTIVE_GOOGLE_NEWS_ENABLED ? "Portfolio + Market Sources" : "Portfolio Sources"
    },
    apac: {
      articles: apacArticles,
      lastUpdated: sectionLastUpdated(apacArticles, generatedAt),
      source: EXECUTIVE_GOOGLE_NEWS_ENABLED ? "Portfolio + Market Sources" : "Portfolio Sources"
    },
    international: {
      articles: internationalArticles,
      lastUpdated: sectionLastUpdated(internationalArticles, generatedAt),
      source: EXECUTIVE_GOOGLE_NEWS_ENABLED
        ? "Portfolio + Market Sources (US/Mexico/Senegal filtered)"
        : "Portfolio Sources (US/Mexico/Senegal filtered)"
    }
  };
}
