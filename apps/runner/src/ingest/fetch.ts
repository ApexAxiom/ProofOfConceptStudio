import { AgentConfig, AgentFeed, RegionSlug, keywordsForPortfolio } from "@proof/shared";
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
}

/**
 * Fallback feeds by region - reliable, high-volume sources used when primary feeds fail
 * These are general O&G/energy feeds that provide content relevant to all categories
 */
const FALLBACK_FEEDS: Record<RegionSlug, AgentFeed[]> = {
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

/**
 * Fetches articles from a list of feeds
 */
async function fetchFromFeeds(feeds: AgentFeed[], maxArticles: number): Promise<ArticleCandidate[]> {
  const collected: ArticleCandidate[] = [];
  
  for (const feed of feeds) {
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
  let collected = await fetchFromFeeds(feeds, agent.maxArticlesToConsider);
  console.log(`[${agent.id}/${region}] Primary feeds returned ${collected.length} articles`);
  
  // Step 2: If not enough articles, use fallback feeds
  if (collected.length < minArticlesNeeded) {
    console.log(`[${agent.id}/${region}] Not enough articles (${collected.length}), trying fallback feeds...`);
    const fallbackFeeds = FALLBACK_FEEDS[region] ?? [];
    
    // Filter out feeds we already tried
    const primaryUrls = new Set(feeds.map((f) => f.url));
    const newFallbacks = fallbackFeeds.filter((f) => !primaryUrls.has(f.url));
    
    if (newFallbacks.length > 0) {
      const fallbackArticles = await fetchFromFeeds(newFallbacks, agent.maxArticlesToConsider);
      collected = [...collected, ...fallbackArticles];
      console.log(`[${agent.id}/${region}] After fallback feeds: ${collected.length} articles`);
    }
  }
  
  // Deduplicate articles by URL
  const deduped = dedupeArticles(collected);

  // Remove articles used in recent runs to keep briefs fresh
  const lookbackDays = agent.lookbackDays ?? 7;
  let usedUrls: Set<string>;
  
  try {
    usedUrls = await getRecentlyUsedUrls({
      portfolio: agent.portfolio,
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
      if (usedUrls.has(normalized)) continue;
      seenNormalized.add(normalized);
    }
    filteredByHistory.push(candidate);
  }

  const minNeeded = Math.max(agent.articlesPerRun ?? 3, 1) * 2;
  let dedupeSafeList = filteredByHistory;
  
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
  const keywords = categoryKeywords.length > 0 ? categoryKeywords : generalKeywords;
  
  const scored = dedupeSafeList
    .map((item) => {
      const hay = `${item.title} ${item.url}`.toLowerCase();
      
      // Primary score: category-specific keywords (weight: 2)
      const categoryScore = categoryKeywords.reduce((acc, kw) => {
        return hay.includes(kw) ? acc + 2 : acc;
      }, 0);
      
      // Secondary score: general O&G keywords (weight: 1)
      const generalScore = generalKeywords.reduce((acc, kw) => {
        return hay.includes(kw) ? acc + 1 : acc;
      }, 0);
      
      return {
        ...item,
        score: categoryScore + generalScore
      };
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

  return {
    articles,
    scannedSources: feeds.map((f) => f.url),
    metrics: {
      collectedCount: collected.length,
      dedupedCount: deduped.length,
      extractedCount: articles.length
    }
  };
}

export type IngestResult = Awaited<ReturnType<typeof ingestAgent>>;
