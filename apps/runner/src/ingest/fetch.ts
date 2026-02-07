import { AgentConfig, AgentFeed, RegionSlug, keywordsForPortfolio, categoryForPortfolio, getGoogleNewsFeeds } from "@proof/shared";
import { fetchRss } from "./rss.js";
import { shallowScrape, fetchArticleDetails, ArticleDetails } from "./extract.js";
import { dedupeArticles } from "./dedupe.js";
import { normalizeForDedupe } from "./url-normalize.js";
import { getRecentlyUsedUrls } from "../db/used-urls.js";
import { FeedAttempt, recordFeedAttempts } from "./feed-health.js";

export interface ArticleCandidate {
  title: string;
  url: string;
  published?: string;
  summary?: string;
  sourceName?: string;
}

export interface ArticleDetail extends ArticleCandidate {
  content?: string;
  ogImageUrl?: string;
  contentStatus?: "ok" | "thin";
}

const MIN_CONTENT_LEN = 300; // Reduced from 400 to allow more articles with good content
const EMPTY_CONTENT_PENALTY = 5;
const THIN_CONTENT_PENALTY = 2;

const COMMON_EXCLUDE_KEYWORDS = [
  "celebrity",
  "entertainment",
  "movie",
  "gaming",
  "lottery",
  "horoscope"
];

/**
 * Build primary/secondary keyword packs for a portfolio.
 */
export function deriveKeywordPack(portfolioSlug: string): { primary: string[]; secondary: string[]; exclude: string[] } {
  const keywords = keywordsForPortfolio(portfolioSlug).map((keyword) => keyword.toLowerCase());
  const primary = keywords.slice(0, 4);
  const secondary = keywords.slice(4);
  return { primary, secondary, exclude: COMMON_EXCLUDE_KEYWORDS };
}

function countMatches(text: string, keywords: string[]): number {
  if (!text || keywords.length === 0) return 0;
  const haystack = text.toLowerCase();
  return keywords.reduce((acc, keyword) => (haystack.includes(keyword.toLowerCase()) ? acc + 1 : acc), 0);
}

/**
 * Score keyword relevance for ranking candidate articles.
 */
export function computeKeywordSignals(
  text: string,
  primaryKeywords: string[],
  secondaryKeywords: string[],
  excludeKeywords: string[],
  generalKeywords: string[]
): {
  primaryMatches: number;
  secondaryMatches: number;
  generalMatches: number;
  hasExclude: boolean;
  score: number;
} {
  const primaryMatches = countMatches(text, primaryKeywords);
  const secondaryMatches = countMatches(text, secondaryKeywords);
  const generalMatches = countMatches(text, generalKeywords);
  const hasExclude = countMatches(text, excludeKeywords) > 0;
  const score = primaryMatches * 4 + secondaryMatches * 2 + generalMatches;
  return { primaryMatches, secondaryMatches, generalMatches, hasExclude, score };
}

const ENERGY_FALLBACK: Record<RegionSlug, AgentFeed[]> = {
  "us-mx-la-lng": [
    { name: "Rigzone", url: "https://www.rigzone.com/news/rss/rigzone_latest.aspx", type: "rss" },
    { name: "Offshore Energy", url: "https://www.offshore-energy.biz/feed/", type: "rss" },
    { name: "EIA Today in Energy", url: "https://www.eia.gov/rss/todayinenergy.xml", type: "rss" },
    { name: "EIA Press Releases", url: "https://www.eia.gov/rss/press_rss.xml", type: "rss" },
    { name: "Federal Register (Energy)", url: "https://www.federalregister.gov/documents/search.rss?conditions%5Bterm%5D=energy", type: "rss" },
    { name: "Federal Register (Oil & Gas)", url: "https://www.federalregister.gov/documents/search.rss?conditions%5Bterm%5D=oil%20gas", type: "rss" },
    { name: "Google News - offshore drilling LNG", url: "https://news.google.com/rss/search?q=offshore%20drilling%20LNG&hl=en-US&gl=US&ceid=US:en&when=7d", type: "rss" }
  ],
  "au": [
    { name: "Offshore Energy", url: "https://www.offshore-energy.biz/feed/", type: "rss" },
    { name: "Australian Mining", url: "https://www.australianmining.com.au/feed/", type: "rss" },
    { name: "Manufacturers Monthly", url: "https://www.manmonthly.com.au/feed/", type: "rss" },
    { name: "Rigzone", url: "https://www.rigzone.com/news/rss/rigzone_latest.aspx", type: "rss" },
    { name: "DISR News", url: "https://www.industry.gov.au/news.xml", type: "rss" },
    { name: "WA Gov Announcements", url: "https://www.wa.gov.au/rss/announcements/export/171", type: "rss" },
    { name: "Google News - Australia offshore drilling LNG", url: "https://news.google.com/rss/search?q=Australia%20offshore%20drilling%20LNG&hl=en-AU&gl=AU&ceid=AU:en&when=7d", type: "rss" }
  ]
};

const FREIGHT_FALLBACK: AgentFeed[] = [
  { name: "FreightWaves", url: "https://www.freightwaves.com/news/feed", type: "rss" },
  { name: "Supply Chain Dive", url: "https://www.supplychaindive.com/feeds/news/", type: "rss" },
  { name: "The Loadstar", url: "https://theloadstar.com/feed/", type: "rss" }
];

const CYBER_FALLBACK: AgentFeed[] = [
  { name: "KrebsOnSecurity", url: "https://krebsonsecurity.com/feed/", type: "rss" },
  { name: "Dark Reading", url: "https://www.darkreading.com/rss.xml", type: "rss" },
  { name: "Ars Technica Security", url: "https://feeds.arstechnica.com/arstechnica/security", type: "rss" },
  { name: "BleepingComputer", url: "https://www.bleepingcomputer.com/feed/", type: "rss" },
  { name: "The Hacker News", url: "https://feeds.feedburner.com/TheHackersNews", type: "rss" },
  { name: "CSO Online", url: "https://www.csoonline.com/feed/", type: "rss" },
  { name: "Cybersecurity Dive", url: "https://www.cybersecuritydive.com/feeds/news/", type: "rss" },
  { name: "Industrial Cyber", url: "https://industrialcyber.co/feed/", type: "rss" }
];

const STEEL_FALLBACK: AgentFeed[] = [
  { name: "Mining Weekly", url: "https://www.miningweekly.com/page/rss", type: "rss" },
  { name: "MetalMiner", url: "https://agmetalminer.com/metal-prices/feed/", type: "rss" },
  { name: "Manufacturers Monthly", url: "https://www.manmonthly.com.au/feed/", type: "rss" },
  { name: "American Iron and Steel Institute", url: "https://www.steel.org/news/", type: "web" },
  { name: "World Oil", url: "https://www.worldoil.com/rss/news", type: "rss" }
];

const SERVICES_FALLBACK: AgentFeed[] = [
  { name: "Consultancy.org", url: "https://www.consultancy.org/news/rss", type: "rss" },
  { name: "Harvard Business Review", url: "https://hbr.org/feed", type: "rss" },
  { name: "HR Dive", url: "https://www.hrdive.com/feeds/news/", type: "rss" },
  { name: "SHRM News", url: "https://www.shrm.org/rss/pages/rss.aspx", type: "rss" },
  { name: "Accounting Today", url: "https://www.accountingtoday.com/feed", type: "rss" }
];

const FACILITY_FALLBACK: AgentFeed[] = [
  { name: "FacilitiesNet", url: "https://www.facilitiesnet.com/rss/maintenancenews.aspx", type: "rss" },
  { name: "Buildings.com", url: "https://www.buildings.com/rss.xml", type: "rss" },
  { name: "Facility Executive", url: "https://facilityexecutive.com/feed/", type: "rss" },
  { name: "Waste360", url: "https://www.waste360.com/rss.xml", type: "rss" },
  { name: "EHS Today", url: "https://www.ehstoday.com/rss", type: "rss" }
];

const BASE_REGULATORY_PACK: Record<RegionSlug, AgentFeed[]> = {
  "us-mx-la-lng": [
    { name: "Federal Register (Energy)", url: "https://www.federalregister.gov/documents/search.rss?conditions%5Bterm%5D=energy", type: "rss" },
    { name: "Federal Register (Oil & Gas)", url: "https://www.federalregister.gov/documents/search.rss?conditions%5Bterm%5D=oil%20gas", type: "rss" },
    { name: "EIA Today in Energy", url: "https://www.eia.gov/rss/todayinenergy.xml", type: "rss" },
    { name: "EIA Press Releases", url: "https://www.eia.gov/rss/press_rss.xml", type: "rss" },
    { name: "BSEE Newsroom", url: "https://www.bsee.gov/newsroom", type: "web" },
    { name: "BOEM Newsroom", url: "https://www.boem.gov/newsroom", type: "web" },
    { name: "OSHA News Releases", url: "https://www.osha.gov/news/newsreleases", type: "web" },
    { name: "EPA News Releases", url: "https://www.epa.gov/newsreleases", type: "web" },
    { name: "FERC News", url: "https://www.ferc.gov/news-events/news", type: "web" }
  ],
  "au": [
    { name: "DISR News", url: "https://www.industry.gov.au/news", type: "web" },
    { name: "WA Government Announcements", url: "https://www.wa.gov.au/government/announcements", type: "web" },
    { name: "NOPSEMA News", url: "https://www.nopsema.gov.au/media/latest-news", type: "web" },
    { name: "NOPTA News", url: "https://www.nopta.gov.au/news", type: "web" },
    { name: "AMSA Safety Updates", url: "https://www.amsa.gov.au/news-community/safety-and-environmental-updates", type: "web" },
    { name: "AEMO Newsroom", url: "https://www.aemo.com.au/newsroom", type: "web" }
  ]
};

const GENERAL_CONTEXT_FEEDS: Record<RegionSlug, AgentFeed[]> = {
  "us-mx-la-lng": [
    { name: "Rigzone", url: "https://www.rigzone.com/news/rss/rigzone_latest.aspx", type: "rss" },
    { name: "Offshore Energy", url: "https://www.offshore-energy.biz/feed/", type: "rss" },
    { name: "EIA Today in Energy", url: "https://www.eia.gov/rss/todayinenergy.xml", type: "rss" },
    { name: "Federal Register (Energy)", url: "https://www.federalregister.gov/documents/search.rss?conditions%5Bterm%5D=energy", type: "rss" }
  ],
  "au": [
    { name: "Offshore Energy", url: "https://www.offshore-energy.biz/feed/", type: "rss" },
    { name: "Australian Mining", url: "https://www.australianmining.com.au/feed/", type: "rss" },
    { name: "Manufacturers Monthly", url: "https://www.manmonthly.com.au/feed/", type: "rss" },
    { name: "DISR News", url: "https://www.industry.gov.au/news.xml", type: "rss" }
  ]
};

function normalizeFeedUrl(url: string): string {
  try {
    return new URL(url).toString();
  } catch {
    return url;
  }
}

function dedupeFeeds(feeds: AgentFeed[]): AgentFeed[] {
  const seen = new Set<string>();
  return feeds.filter((feed) => {
    const key = normalizeFeedUrl(feed.url);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getBaseRegulatoryFeeds(region: RegionSlug): AgentFeed[] {
  return BASE_REGULATORY_PACK[region] ?? [];
}

function getGoogleNewsFallbackFeeds(region: RegionSlug, portfolioSlug: string): AgentFeed[] {
  const mappedRegion = region === "au" ? "apac" : "intl";
  const sources = getGoogleNewsFeeds(portfolioSlug, mappedRegion);
  return sources.map((source) => ({
    name: source.name,
    url: source.rssUrl ?? source.url,
    type: "rss"
  }));
}

function getFallbackFeeds(region: RegionSlug, portfolioSlug: string): AgentFeed[] {
  const category = categoryForPortfolio(portfolioSlug);
  if (category === "energy") {
    return ENERGY_FALLBACK[region] ?? [];
  }
  if (category === "freight") return FREIGHT_FALLBACK;
  if (category === "cyber") return CYBER_FALLBACK;
  if (category === "steel") return STEEL_FALLBACK;
  if (category === "services") return SERVICES_FALLBACK;
  if (category === "facility") return FACILITY_FALLBACK;
  return [];
}

export async function fetchGeneralContextArticles(params: {
  region: RegionSlug;
  agentId: string;
  maxArticles?: number;
}): Promise<ArticleDetail[]> {
  const target = Math.max(1, Math.min(params.maxArticles ?? 3, 3));
  const attemptedFeeds = new Set<string>();
  const feeds = dedupeFeeds([
    ...(GENERAL_CONTEXT_FEEDS[params.region] ?? []),
    ...getBaseRegulatoryFeeds(params.region).slice(0, 2)
  ]);

  if (feeds.length === 0) return [];

  const collected = await fetchFromFeeds(feeds, target * 4, attemptedFeeds, {
    agentId: `${params.agentId}:context`,
    region: params.region
  });

  const deduped = dedupeArticles(collected).slice(0, target * 4);
  if (deduped.length === 0) return [];

  const details: ArticleDetail[] = await Promise.all(
    deduped.slice(0, target * 3).map(async (candidate) => {
      try {
        const extracted = await fetchArticleDetails(candidate.url);
        const content = extracted.content ?? candidate.summary;
        const contentLength = (content ?? "").trim().length;
        return {
          title: extracted.title || candidate.title,
          url: candidate.url,
          published: candidate.published ?? extracted.publishedAt,
          summary: extracted.description ?? candidate.summary,
          content,
          ogImageUrl: extracted.ogImageUrl,
          sourceName: extracted.sourceName || candidate.sourceName,
          contentStatus: contentLength >= MIN_CONTENT_LEN ? "ok" : "thin"
        } satisfies ArticleDetail;
      } catch (error) {
        console.warn(`[${params.agentId}/${params.region}] context article extraction failed`, (error as Error).message);
        const contentLength = (candidate.summary ?? "").trim().length;
        return {
          title: candidate.title,
          url: candidate.url,
          published: candidate.published,
          summary: candidate.summary,
          content: candidate.summary,
          sourceName: candidate.sourceName,
          contentStatus: contentLength >= MIN_CONTENT_LEN ? "ok" : "thin"
        } satisfies ArticleDetail;
      }
    })
  );

  return details.slice(0, target);
}

/**
 * Fetches articles from a list of feeds
 */
async function fetchFromFeeds(
  feeds: AgentFeed[],
  maxArticles: number,
  attemptedFeeds: Set<string>,
  context: { agentId: string; region: RegionSlug }
): Promise<ArticleCandidate[]> {
  const collected: ArticleCandidate[] = [];
  const feedAttempts: FeedAttempt[] = [];

  for (const feed of feeds) {
    const checkedAt = new Date().toISOString();
    attemptedFeeds.add(feed.url);
    try {
      if (feed.type === "rss") {
        const items = await fetchRss(feed);
        feedAttempts.push({
          url: feed.url,
          name: feed.name,
          agentId: context.agentId,
          region: context.region,
          checkedAt,
          status: items.length > 0 ? "ok" : "empty",
          itemCount: items.length
        });
        collected.push(
          ...items.slice(0, maxArticles).map((i: any) => ({
            title: i.title,
            url: i.link,
            published: i.pubDate,
            sourceName: feed.name
          }))
        );
      } else {
        const links = await shallowScrape(feed.url, maxArticles);
        feedAttempts.push({
          url: feed.url,
          name: feed.name,
          agentId: context.agentId,
          region: context.region,
          checkedAt,
          status: links.length > 0 ? "ok" : "empty",
          itemCount: links.length
        });
        collected.push(
          ...links.map((l) => ({
            title: l.title,
            url: l.url,
            sourceName: feed.name
          }))
        );
      }
    } catch (err) {
      feedAttempts.push({
        url: feed.url,
        name: feed.name,
        agentId: context.agentId,
        region: context.region,
        checkedAt,
        status: "error",
        itemCount: 0,
        error: (err as Error).message
      });
      console.error(`Feed error for ${feed.name}:`, err);
    }
  }

  await recordFeedAttempts(feedAttempts).catch((error) => {
    console.warn(`[${context.agentId}/${context.region}] Failed to persist feed health`, (error as Error).message);
  });
  
  return collected;
}

/**
 * Ingests articles from all feeds for an agent in a specific region.
 * Returns enriched article details with preserved exact URLs.
 * Includes fallback feeds when primary feeds don't provide enough articles.
 */
export async function ingestAgent(agent: AgentConfig, region: RegionSlug) {
  const feeds = dedupeFeeds([
    ...(agent.feedsByRegion[region] ?? []),
    ...getBaseRegulatoryFeeds(region)
  ]);
  const minArticlesNeeded = Math.max(agent.articlesPerRun ?? 3, 3) * 2; // Need at least 2x required articles
  
  // Step 1: Fetch from primary feeds
  const attemptedFeeds = new Set<string>();
  let collected = await fetchFromFeeds(feeds, agent.maxArticlesToConsider, attemptedFeeds, {
    agentId: agent.id,
    region
  });
  console.log(`[${agent.id}/${region}] Primary feeds returned ${collected.length} articles`);
  
  // Step 2: If not enough articles, use fallback feeds
  if (collected.length < minArticlesNeeded) {
    console.log(`[${agent.id}/${region}] Not enough articles (${collected.length}), trying fallback feeds...`);
    const fallbackFeeds = dedupeFeeds([
      ...getFallbackFeeds(region, agent.portfolio),
      ...getGoogleNewsFallbackFeeds(region, agent.portfolio)
    ]);
    
    // Filter out feeds we already tried
    const primaryUrls = new Set(feeds.map((f) => f.url));
    const newFallbacks = fallbackFeeds.filter((f) => !primaryUrls.has(f.url));
    
    if (newFallbacks.length > 0) {
      const fallbackArticles = await fetchFromFeeds(newFallbacks, agent.maxArticlesToConsider, attemptedFeeds, {
        agentId: agent.id,
        region
      });
      collected = [...collected, ...fallbackArticles];
      console.log(`[${agent.id}/${region}] After fallback feeds: ${collected.length} articles`);
    }
  }
  
  // Deduplicate articles by URL
  const deduped = dedupeArticles(collected);

  // Remove articles used in recent runs to keep briefs fresh
  // Reduced from 7 to 3 days to allow more article reuse across categories
  // NOTE: Duplicate filtering is category-specific (by portfolio). The same article
  // can be used by different categories, as each category's AI agent analyzes news
  // from their own domain perspective. This prevents duplicates within a category
  // while allowing cross-category article reuse.
  const lookbackDays = agent.lookbackDays ?? 3;
  let usedUrls: Set<string>;
  
  try {
    usedUrls = await getRecentlyUsedUrls({
      portfolio: agent.portfolio, // Category-specific filtering
      region,
      lookbackDays,
      limit: 200
    });
  } catch (err) {
    console.warn(`[${agent.id}/${region}] Failed to fetch used URLs, continuing without filter:`, err);
    usedUrls = new Set();
  }

  const filteredByHistory: ArticleCandidate[] = [];
  const seenNormalized = new Set<string>();
  for (const candidate of deduped) {
    const normalized = normalizeForDedupe(candidate.url);
    if (normalized) {
      // Skip only if this URL was used in THIS category (portfolio) recently
      // Same URL can be used by other categories
      if (usedUrls.has(normalized)) continue;
      seenNormalized.add(normalized);
    }
    filteredByHistory.push(candidate);
  }

  const normalizeDomain = (url: string) => {
    try {
      return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    } catch {
      return "";
    }
  };

  const allowDomains = agent.allowDomains?.map((d) => d.toLowerCase()) ?? [];
  const denyDomains = agent.denyDomains?.map((d) => d.toLowerCase()) ?? [];

  const domainFiltered = filteredByHistory.filter((candidate) => {
    const domain = normalizeDomain(candidate.url);
    if (!domain) return false;
    if (denyDomains.length > 0 && denyDomains.some((d) => domain.includes(d))) return false;
    if (allowDomains.length > 0 && !allowDomains.some((d) => domain.includes(d))) return false;
    return true;
  });

  const filteredCandidates = domainFiltered.length > 0 ? domainFiltered : filteredByHistory;

  const minNeeded = Math.max(agent.articlesPerRun ?? 3, 1) * 2;
  let dedupeSafeList = filteredCandidates;
  
  // If not enough fresh articles, progressively relax the history filter
  if (dedupeSafeList.length < minNeeded) {
    console.log(`[${agent.id}/${region}] Only ${dedupeSafeList.length} fresh articles, allowing some reuse...`);
    
    // First pass: add back articles from the oldest half of the lookback period
    for (const candidate of deduped) {
      const normalized = normalizeForDedupe(candidate.url);
      if (normalized && seenNormalized.has(normalized)) continue;
      dedupeSafeList.push(candidate);
      if (normalized) seenNormalized.add(normalized);
      if (dedupeSafeList.length >= minNeeded) break;
    }
    
    console.log(`[${agent.id}/${region}] After relaxing filter: ${dedupeSafeList.length} articles`);
  }
  
  // General O&G keywords that apply to all categories - used as fallback
  const generalKeywords = [
    "oil", "gas", "lng", "drilling", "offshore", "energy", "petroleum",
    "pipeline", "refinery", "production", "exploration", "well", "rig",
    "subsea", "upstream", "downstream", "midstream", "supplier", "contract"
  ];
  
  // Score articles by keyword relevance
  const keywordPack = deriveKeywordPack(agent.portfolio);
  const primaryKeywords = keywordPack.primary;
  const secondaryKeywords = keywordPack.secondary;
  const excludeKeywords = keywordPack.exclude;

  const scoredAll = dedupeSafeList
    .map((item) => {
      const hay = `${item.title} ${item.url} ${item.summary ?? ""}`.toLowerCase();
      const signals = computeKeywordSignals(hay, primaryKeywords, secondaryKeywords, excludeKeywords, generalKeywords);
      return { ...item, ...signals };
    })
    .filter((item) => !item.hasExclude)
    .sort((a, b) => b.score - a.score);

  const primaryQualified = scoredAll.filter((item) => item.primaryMatches > 0);
  const scored =
    primaryQualified.length >= minNeeded
      ? primaryQualified
      : scoredAll;
  
  // Take top 12 candidates for detailed extraction (increased from 10 for more options)
  const top = scored.slice(0, 12);

  // Fetch details in parallel batches while preserving order
  const orderedResults: (ArticleDetail | undefined)[] = Array(top.length);
  const limit = 4; // Concurrent fetch limit
  
  for (let i = 0; i < top.length; i += limit) {
    const slice = top.slice(i, i + limit);
    await Promise.all(
      slice.map(async (candidate, idx) => {
        const absoluteIndex = i + idx;
        try {
          const details = await fetchArticleDetails(candidate.url);
          orderedResults[absoluteIndex] = {
            title: details.title || candidate.title,
            url: candidate.url, // ALWAYS preserve the original URL
            published: candidate.published ?? details.publishedAt,
            summary: details.description ?? candidate.summary,
            content: details.content,
            ogImageUrl: details.ogImageUrl,
            sourceName: details.sourceName || candidate.sourceName // Prefer extracted, fall back to feed config
          };
        } catch (err) {
          console.error(`Detail fetch failed for ${candidate.url}:`, err);
          // Still include the article with basic info if detail fetch fails
          orderedResults[absoluteIndex] = {
            title: candidate.title,
            url: candidate.url,
            published: candidate.published,
            summary: candidate.summary,
            sourceName: candidate.sourceName
          };
        }
      })
    );
  }

  // Filter out undefined results while preserving valid articles
  const articles = orderedResults.filter((r): r is ArticleDetail => Boolean(r));

  const rankedByContent = articles
    .map((article, idx) => {
      const contentLen = (article.content ?? "").trim().length;
      const contentSignals = computeKeywordSignals(
        article.content ?? "",
        primaryKeywords,
        secondaryKeywords,
        excludeKeywords,
        generalKeywords
      );
      const baseScore = top[idx]?.score ?? 0;
      const penalty = contentLen === 0 ? EMPTY_CONTENT_PENALTY : contentLen < MIN_CONTENT_LEN ? THIN_CONTENT_PENALTY : 0;
      const excludePenalty = contentSignals.hasExclude ? 3 : 0;
      return {
        article: { ...article, contentStatus: contentLen >= MIN_CONTENT_LEN ? "ok" : "thin" },
        combinedScore: baseScore + contentSignals.score - penalty - excludePenalty
      };
    })
    .sort((a, b) => b.combinedScore - a.combinedScore)
    .map((entry) => entry.article);

  const contentQualified = rankedByContent.filter((article) => article.contentStatus === "ok");
  const finalArticles = contentQualified.length > 0 ? contentQualified : rankedByContent;

  return {
    articles: finalArticles,
    scannedSources: Array.from(attemptedFeeds),
    metrics: {
      collectedCount: collected.length,
      dedupedCount: deduped.length,
      extractedCount: articles.length
    }
  };
}

export type IngestResult = Awaited<ReturnType<typeof ingestAgent>>;
