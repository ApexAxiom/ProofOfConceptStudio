import { getPortfolioSources } from "@proof/shared";
import { getExecutiveMarketQuotes, MarketQuote } from "./market-data";

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

const FEED_TIMEOUT_MS = 8_000;
const MAX_ITEMS_PER_FEED = 6;
const SECTION_LIMIT = 12;
const MAX_ARTICLE_AGE_DAYS = 7;

const WOODSIDE_FEEDS: RssFeed[] = [
  {
    url: "https://news.google.com/rss/search?q=Woodside%20Energy&hl=en-US&gl=US&ceid=US:en",
    source: "Google News",
    category: "Woodside",
    region: "woodside"
  }
];

const APAC_FEEDS: RssFeed[] = [
  ...getPortfolioSources("market-dashboard", "apac")
    .map((source) => source.rssUrl ?? source.url)
    .filter((url) => url.includes("rss") || url.includes("/feed"))
    .map((url) => ({
      url,
      source: "Portfolio Sources",
      category: "Oil & Gas",
      region: "apac" as const
    })),
  {
    url: "https://news.google.com/rss/search?q=oil%20gas%20APAC%20LNG&hl=en-AU&gl=AU&ceid=AU:en",
    source: "Google News",
    category: "Oil & Gas",
    region: "apac"
  }
];

const INTERNATIONAL_FEEDS: RssFeed[] = [
  ...getPortfolioSources("market-dashboard", "intl")
    .map((source) => source.rssUrl ?? source.url)
    .filter((url) => url.includes("rss") || url.includes("/feed"))
    .map((url) => ({
      url,
      source: "Portfolio Sources",
      category: "Oil & Gas",
      region: "international" as const
    })),
  {
    url: "https://news.google.com/rss/search?q=oil%20gas%20LNG%20US%20Mexico%20Senegal&hl=en-US&gl=US&ceid=US:en",
    source: "Google News",
    category: "Oil & Gas",
    region: "international"
  }
];

const APAC_KEYWORDS = ["apac", "australia", "perth", "asia", "lng", "offshore"];
const INTERNATIONAL_KEYWORDS = ["us", "united states", "mexico", "senegal", "houston", "lng", "gulf"];

const FALLBACK_ARTICLES: Record<ExecutiveRegion, ExecutiveArticle[]> = {
  woodside: [
    {
      title: "Woodside Energy headlines unavailable. Feed refresh in progress.",
      url: "https://news.google.com/search?q=Woodside%20Energy",
      source: "System",
      publishedAt: new Date().toISOString(),
      category: "Woodside",
      region: "woodside",
      summary: "Temporary fallback while live RSS feed refreshes."
    }
  ],
  apac: [
    {
      title: "APAC Oil & Gas feed refresh in progress",
      url: "https://news.google.com/search?q=APAC%20oil%20gas%20LNG",
      source: "System",
      publishedAt: new Date().toISOString(),
      category: "Oil & Gas",
      region: "apac",
      summary: "Live APAC coverage is temporarily unavailable."
    }
  ],
  international: [
    {
      title: "International Oil & Gas feed refresh in progress",
      url: "https://news.google.com/search?q=US%20Mexico%20Senegal%20oil%20gas%20LNG",
      source: "System",
      publishedAt: new Date().toISOString(),
      category: "Oil & Gas",
      region: "international",
      summary: "Live US/Mexico/Senegal coverage is temporarily unavailable."
    }
  ]
};

function dedupeByUrlAndTitle(articles: ExecutiveArticle[]): ExecutiveArticle[] {
  const seen = new Set<string>();
  const output: ExecutiveArticle[] = [];
  for (const article of articles) {
    const key = `${article.url.toLowerCase()}::${article.title.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(article);
  }
  return output;
}

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

function extractDomain(url: string): string | undefined {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
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
      next: { revalidate: 3_600 }
    });
    if (!response.ok) return [];

    const xml = await response.text();
    const itemMatches = Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)).slice(0, MAX_ITEMS_PER_FEED);
    const articles: ExecutiveArticle[] = [];

    for (const match of itemMatches) {
      const item = match[1];
      const title = parseTagValue(item, "title");
      const link = parseTagValue(item, "link");
      const pubDate = parseTagValue(item, "pubDate");
      const description = parseTagValue(item, "description");
      const imageMatch = item.match(/url="([^"]+\.(jpg|jpeg|png|webp)[^"]*)"/i);
      const publishedAt = pubDate ? new Date(pubDate).toISOString() : new Date().toISOString();

      if (!title || !link || !looksFresh(publishedAt)) continue;
      articles.push({
        title: title.replace(/\s+/g, " ").trim(),
        url: link,
        source: feed.source,
        publishedAt,
        category: feed.category,
        region: feed.region,
        summary: description?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 180),
        imageUrl: imageMatch?.[1],
        domain: extractDomain(link)
      });
    }

    return articles;
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

async function collectSectionArticles(feeds: RssFeed[], keywords: string[]): Promise<ExecutiveArticle[]> {
  const buckets = await Promise.all(feeds.map((feed) => fetchRssFeed(feed)));
  const merged = dedupeByUrlAndTitle(buckets.flat())
    .filter((article) => matchesKeywords(`${article.title} ${article.summary ?? ""}`, keywords))
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, SECTION_LIMIT);
  return merged;
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
  const [market, woodsideLive, apacLive, internationalLive] = await Promise.all([
    getExecutiveMarketQuotes(),
    collectSectionArticles(WOODSIDE_FEEDS, ["woodside", "scarborough", "sangomar", "lng"]),
    collectSectionArticles(APAC_FEEDS, APAC_KEYWORDS),
    collectSectionArticles(INTERNATIONAL_FEEDS, INTERNATIONAL_KEYWORDS)
  ]);

  const woodsideArticles = woodsideLive.length > 0 ? woodsideLive : FALLBACK_ARTICLES.woodside;
  const apacArticles = apacLive.length > 0 ? apacLive : FALLBACK_ARTICLES.apac;

  // Prevent duplication across APAC and International sections.
  const apacUrls = new Set(apacArticles.map((article) => article.url.toLowerCase()));
  const internationalArticlesRaw = internationalLive.filter((article) => !apacUrls.has(article.url.toLowerCase()));
  const internationalArticles =
    internationalArticlesRaw.length > 0 ? internationalArticlesRaw : FALLBACK_ARTICLES.international;

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
      source: "Google News RSS (Woodside Energy)"
    },
    apac: {
      articles: apacArticles,
      lastUpdated: sectionLastUpdated(apacArticles, generatedAt),
      source: "Portfolio + Google News APAC O&G feeds"
    },
    international: {
      articles: internationalArticles,
      lastUpdated: sectionLastUpdated(internationalArticles, generatedAt),
      source: "Portfolio + Google News International O&G feeds (US/Mexico/Senegal filtered)"
    }
  };
}

