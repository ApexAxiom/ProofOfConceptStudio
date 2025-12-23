import { AgentConfig, RegionSlug } from "@proof/shared";
import { fetchRss } from "./rss.js";
import { shallowScrape } from "./extract.js";
import { dedupeArticles } from "./dedupe.js";

export interface ArticleCandidate {
  title: string;
  url: string;
  published?: string;
  summary?: string;
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
  const deduped = dedupeArticles(collected).slice(0, 20);
  return { articles: deduped, scannedSources: feeds.map((f) => f.url) };
}
