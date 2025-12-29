import { XMLParser } from "fast-xml-parser";
import { AgentFeed } from "@proof/shared";
import { request } from "undici";

// Browser-like headers to avoid 403/400 errors from RSS feeds
const RSS_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, */*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
};

export async function fetchRss(feed: AgentFeed) {
  try {
    const res = await request(feed.url, { 
      method: "GET",
      headers: RSS_HEADERS,
      maxRedirections: 5,
      bodyTimeout: 30000,
      headersTimeout: 15000,
    });
    
    if (res.statusCode >= 400) {
      console.warn(`RSS feed ${feed.name} returned status ${res.statusCode}`);
      return [];
    }
    
    const text = await res.body.text();
    
    // Check if response looks like XML
    const trimmed = text.trim().toLowerCase();
    if (!trimmed.startsWith("<?xml") && !trimmed.startsWith("<rss") && !trimmed.startsWith("<feed")) {
      console.warn(`RSS feed ${feed.name} did not return valid XML`);
      return [];
    }
    
    const parser = new XMLParser({ ignoreAttributes: false });
    const parsed = parser.parse(text);
    const items = parsed.rss?.channel?.item ?? parsed.feed?.entry ?? [];
    
    // Handle single item (not array)
    const itemArray = Array.isArray(items) ? items : [items];
    
    return itemArray
      .map((item: any) => ({
        title: item.title?._text || item.title || "",
        link: item.link?.["@_href"] || item.link?.href || item.link || item.guid || "",
        pubDate: item.pubDate || item.updated || item.published || item["dc:date"]
      }))
      .filter((i: any) => i.link && typeof i.link === "string");
  } catch (err) {
    console.error(`Failed to fetch RSS feed ${feed.name}:`, err);
    return [];
  }
}
