import { request } from "undici";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";

function resolveUrl(href: string, baseUrl: string): string | null {
  if (!href) return null;
  if (href.startsWith("#") || href.startsWith("javascript:") || href.startsWith("mailto:")) return null;
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

export async function shallowScrape(url: string, limit = 30): Promise<{ title: string; url: string }[]> {
  const res = await request(url, { method: "GET" });
  const text = await res.body.text();
  const dom = new JSDOM(text, { url });
  const baseHost = new URL(url).hostname;
  const anchors = Array.from(dom.window.document.querySelectorAll("a")) as unknown as HTMLAnchorElement[];
  const links = anchors
    .map((a) => {
      const resolved = resolveUrl(a.getAttribute("href") ?? "", url);
      return {
        title: (a.textContent ?? "").trim(),
        url: resolved
      };
    })
    .filter((l): l is { title: string; url: string } => typeof l.url === "string" && l.url.startsWith("http"))
    .filter((l) => {
      try {
        const host = new URL(l.url).hostname;
        return host.endsWith(baseHost);
      } catch {
        return false;
      }
    });
  const deduped = Array.from(new Map(links.map((l) => [l.url, l])).values());
  return deduped.slice(0, limit);
}

export async function fetchArticleDetails(url: string): Promise<{
  url: string;
  title: string;
  content: string;
  ogImageUrl?: string;
  publishedAt?: string;
  description?: string;
}> {
  try {
    const res = await request(url, {
      method: "GET",
      headers: { "user-agent": "ProofRunnerBot/1.0" },
      maxRedirections: 3,
      bodyTimeout: 10000
    });
    const html = await res.body.text();
    const dom = new JSDOM(html, { url });
    const document = dom.window.document;
    const reader = new Readability(document);
    const article = reader.parse();
    const ogImage =
      document.querySelector('meta[property="og:image"]')?.getAttribute("content") ||
      document.querySelector('meta[property="og:image:url"]')?.getAttribute("content") ||
      document.querySelector('meta[name="twitter:image"]')?.getAttribute("content") ||
      undefined;
    const resolvedOg = ogImage ? resolveUrl(ogImage, url) ?? ogImage : undefined;
    return {
      url,
      title: article?.title || document.title || url,
      content: article?.textContent || "",
      ogImageUrl: resolvedOg,
      publishedAt:
        document.querySelector('meta[property="article:published_time"]')?.getAttribute("content") || undefined,
      description: document.querySelector('meta[name="description"]')?.getAttribute("content") || undefined
    };
  } catch {
    return {
      url,
      title: url,
      content: ""
    };
  }
}
