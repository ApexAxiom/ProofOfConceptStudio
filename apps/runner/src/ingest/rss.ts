import { XMLParser } from "fast-xml-parser";
import { AgentFeed } from "@proof/shared";
import { request } from "undici";

export async function fetchRss(feed: AgentFeed) {
  const res = await request(feed.url, { method: "GET" });
  const text = await res.body.text();
  const parser = new XMLParser({ ignoreAttributes: false });
  const parsed = parser.parse(text);
  const items = parsed.rss?.channel?.item ?? parsed.feed?.entry ?? [];
  return items
    .map((item: any) => ({
      title: item.title?._text || item.title || "",
      link: item.link?.href || item.link || item.guid || "",
      pubDate: item.pubDate || item.updated || item.published
    }))
    .filter((i: any) => i.link);
}
