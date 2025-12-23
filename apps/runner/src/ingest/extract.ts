import { request } from "undici";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";

export async function shallowScrape(url: string, limit = 30): Promise<{ title: string; url: string }[]> {
  const res = await request(url, { method: "GET" });
  const text = await res.body.text();
  const dom = new JSDOM(text, { url });
  const links = Array.from(dom.window.document.querySelectorAll("a"))
    .map((a) => ({ title: a.textContent?.trim() ?? "", url: a.getAttribute("href") ?? "" }))
    .filter((l) => l.url && l.url.startsWith("http"));
  return links.slice(0, limit);
}

export async function fetchAndExtract(url: string): Promise<{ title: string; content: string }> {
  const res = await request(url, { method: "GET" });
  const html = await res.body.text();
  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();
  return {
    title: article?.title || dom.window.document.title || url,
    content: article?.textContent || ""
  };
}
