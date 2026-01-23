import { AgentConfig, AgentFeed, RegionSlug, keywordsForPortfolio, categoryForPortfolio } from "@proof/shared";
import { fetchRss } from "./rss.js";
import { shallowScrape, fetchArticleDetails, ArticleDetails } from "./extract.js";
import { dedupeArticles } from "./dedupe.js";
import { normalizeForDedupe } from "./url-normalize.js";
import { getRecentlyUsedUrls } from "../db/used-urls.js";

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

function computeKeywordScore(text: string, categoryKeywords: string[], generalKeywords: string[]): number {
  if (!text) return 0;
  const haystack = text.toLowerCase();
  const categoryScore = categoryKeywords.reduce((acc, kw) => (haystack.includes(kw) ? acc + 2 : acc), 0);
  const generalScore = generalKeywords.reduce((acc, kw) => (haystack.includes(kw) ? acc + 1 : acc), 0);
  return categoryScore + generalScore;
}

const ENERGY_FALLBACK: Record<RegionSlug, AgentFeed[]> = {
  "us-mx-la-lng": [
    { name: "Rigzone", url: "https://www.rigzone.com/news/rss/rigzone_latest.aspx", type: "rss" },
    { name: "World Oil", url: "https://www.worldoil.com/rss/news", type: "rss" },
    { name: "Oil & Gas Journal", url: "https://www.ogj.com/rss", type: "rss" },
    { name: "Offshore Energy", url: "https://www.offshore-energy.biz/feed/", type: "rss" },
    { name: "Energy Voice", url: "https://www.energyvoice.com/feed/", type: "rss" },
    { name: "EIA Today in Energy", url: "https://www.eia.gov/rss/todayinenergy.xml", type: "rss" },
  ],
  "au": [
    { name: "Offshore Energy", url: "https://www.offshore-energy.biz/feed/", type: "rss" },
    { name: "Australian Mining", url: "https://www.australianmining.com.au/feed/", type: "rss" },
    { name: "Energy Voice", url: "https://www.energyvoice.com/feed/", type: "rss" },
    { name: "Process Online", url: "https://www.processonline.com.au/feed/", type: "rss" },
    { name: "Manufacturers Monthly", url: "https://www.manmonthly.com.au/feed/", type: "rss" },
    { name: "Rigzone", url: "https://www.rigzone.com/news/rss/rigzone_latest.aspx", type: "rss" },
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

/**
 * Fetches articles from a list of feeds
 */
async function fetchFromFeeds(
  feeds: AgentFeed[],
  maxArticles: number,
  attemptedFeeds: Set<string>
): Promise<ArticleCandidate[]> {
  const collected: ArticleCandidate[] = [];

  for (const feed of feeds) {
    attemptedFeeds.add(feed.url);
    try {
      if (feed.type === "rss") {
        const items = await fetchRss(feed);
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
        collected.push(
          ...links.map((l) => ({
            title: l.title,
            url: l.url,
            sourceName: feed.name
          }))
        );
      }
    } catch (err) {
      console.error(`Feed error for ${feed.name}:`, err);
    }
  }
  
  return collected;
}

/**
 * Ingests articles from all feeds for an agent in a specific region.
 * Returns enriched article details with preserved exact URLs.
 * Includes fallback feeds when primary feeds don't provide enough articles.
 */
export async function ingestAgent(agent: AgentConfig, region: RegionSlug) {
  const feeds = agent.feedsByRegion[region] ?? [];
  const minArticlesNeeded = Math.max(agent.articlesPerRun ?? 3, 3) * 2; // Need at least 2x required articles
  
  // Step 1: Fetch from primary feeds
  const attemptedFeeds = new Set<string>();
  let collected = await fetchFromFeeds(feeds, agent.maxArticlesToConsider, attemptedFeeds);
  console.log(`[${agent.id}/${region}] Primary feeds returned ${collected.length} articles`);
  
  // Step 2: If not enough articles, use fallback feeds
  if (collected.length < minArticlesNeeded) {
    console.log(`[${agent.id}/${region}] Not enough articles (${collected.length}), trying fallback feeds...`);
    const fallbackFeeds = getFallbackFeeds(region, agent.portfolio);
    
    // Filter out feeds we already tried
    const primaryUrls = new Set(feeds.map((f) => f.url));
    const newFallbacks = fallbackFeeds.filter((f) => !primaryUrls.has(f.url));
    
    if (newFallbacks.length > 0) {
      const fallbackArticles = await fetchFromFeeds(newFallbacks, agent.maxArticlesToConsider, attemptedFeeds);
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
  const categoryKeywords = keywordsForPortfolio(agent.portfolio).map((k) => k.toLowerCase());

  const scored = dedupeSafeList
    .map((item) => {
      const hay = `${item.title} ${item.url}`;
      const score = computeKeywordScore(hay, categoryKeywords, generalKeywords);
      return { ...item, score };
    })
    .sort((a, b) => b.score - a.score);
  
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
      const contentScore = computeKeywordScore(article.content ?? "", categoryKeywords, generalKeywords);
      const baseScore = top[idx]?.score ?? 0;
      const penalty = contentLen === 0 ? EMPTY_CONTENT_PENALTY : contentLen < MIN_CONTENT_LEN ? THIN_CONTENT_PENALTY : 0;
      return { article: { ...article, contentStatus: contentLen >= MIN_CONTENT_LEN ? "ok" : "thin" }, combinedScore: baseScore + contentScore - penalty };
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
