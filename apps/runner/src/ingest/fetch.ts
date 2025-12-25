import { AgentConfig, RegionSlug, keywordsForPortfolio } from "@proof/shared";
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
 * Ingests articles from all feeds for an agent in a specific region.
 * Returns enriched article details with preserved exact URLs.
 */
export async function ingestAgent(agent: AgentConfig, region: RegionSlug) {
  const feeds = agent.feedsByRegion[region] ?? [];
  const collected: ArticleCandidate[] = [];
  
  for (const feed of feeds) {
    try {
      if (feed.type === "rss") {
        const items = await fetchRss(feed);
        collected.push(
          ...items.slice(0, agent.maxArticlesToConsider).map((i: any) => ({
            title: i.title,
            url: i.link,
            published: i.pubDate,
            sourceName: feed.name // Preserve the source name from feed config
          }))
        );
      } else {
        const links = await shallowScrape(feed.url, agent.maxArticlesToConsider);
        collected.push(
          ...links.map((l) => ({
            title: l.title,
            url: l.url,
            sourceName: feed.name // Preserve the source name from feed config
          }))
        );
      }
    } catch (err) {
      console.error(`Feed error for ${feed.name}:`, err);
    }
  }
  
  // Deduplicate articles by URL
  const deduped = dedupeArticles(collected);

  // Remove articles used in recent runs to keep briefs fresh
  const lookbackDays = agent.lookbackDays ?? 7;
  const usedUrls = await getRecentlyUsedUrls({
    portfolio: agent.portfolio,
    region,
    lookbackDays,
    limit: 200
  });

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
  if (dedupeSafeList.length < minNeeded) {
    for (const candidate of deduped) {
      const normalized = normalizeForDedupe(candidate.url);
      if (normalized && seenNormalized.has(normalized)) continue;
      dedupeSafeList.push(candidate);
      if (normalized) seenNormalized.add(normalized);
      if (dedupeSafeList.length >= minNeeded) break;
    }
  }
  
  // Score articles by keyword relevance
  const keywords = keywordsForPortfolio(agent.portfolio).map((k) => k.toLowerCase());
  const scored = dedupeSafeList
    .map((item) => ({
      ...item,
      score: keywords.reduce((acc, kw) => {
        const hay = `${item.title} ${item.url}`.toLowerCase();
        return hay.includes(kw) ? acc + 1 : acc;
      }, 0)
    }))
    .sort((a, b) => b.score - a.score);
  
  // Take top 10 candidates for detailed extraction
  const top = scored.slice(0, 10);

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
