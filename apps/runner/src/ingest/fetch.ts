import { AgentConfig, RegionSlug, keywordsForPortfolio } from "@proof/shared";
import { fetchRss } from "./rss.js";
import { shallowScrape, fetchArticleDetails } from "./extract.js";
import { dedupeArticles } from "./dedupe.js";

export interface ArticleCandidate {
  title: string;
  url: string;
  published?: string;
  summary?: string;
}

export interface ArticleDetail extends ArticleCandidate {
  content?: string;
  ogImageUrl?: string;
}

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
            published: i.pubDate
          }))
        );
      } else {
        const links = await shallowScrape(feed.url, agent.maxArticlesToConsider);
        collected.push(...links.map((l) => ({ title: l.title, url: l.url })));
      }
    } catch (err) {
      console.error(`Feed error for ${feed.name}`, err);
    }
  }
  const deduped = dedupeArticles(collected);
  const keywords = keywordsForPortfolio(agent.portfolio).map((k) => k.toLowerCase());
  const scored = deduped
    .map((item) => ({
      ...item,
      score: keywords.reduce((acc, kw) => {
        const hay = `${item.title} ${item.url}`.toLowerCase();
        return hay.includes(kw) ? acc + 1 : acc;
      }, 0)
    }))
    .sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 10);

  const orderedResults: (ArticleDetail | undefined)[] = Array(top.length);
  const limit = 4;
  for (let i = 0; i < top.length; i += limit) {
    const slice = top.slice(i, i + limit);
    await Promise.all(
      slice.map(async (candidate, idx) => {
        const absoluteIndex = i + idx;
        try {
          const details = await fetchArticleDetails(candidate.url);
          orderedResults[absoluteIndex] = {
            title: details.title || candidate.title,
            url: candidate.url,
            published: candidate.published ?? details.publishedAt,
            summary: details.description ?? candidate.summary,
            content: details.content,
            ogImageUrl: details.ogImageUrl
          };
        } catch (err) {
          console.error(`Detail fetch failed for ${candidate.url}`, err);
        }
      })
    );
  }

  return {
    articles: orderedResults.filter((r): r is ArticleDetail => Boolean(r)),
    scannedSources: feeds.map((f) => f.url),
    metrics: {
      collectedCount: collected.length,
      dedupedCount: deduped.length,
      extractedCount: orderedResults.filter(Boolean).length
    }
  };
}
