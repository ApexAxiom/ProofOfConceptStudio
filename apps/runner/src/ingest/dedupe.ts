import { ArticleCandidate } from "./fetch.js";
import { normalizeForDedupe } from "./url-normalize.js";

export function dedupeArticles(articles: ArticleCandidate[]): ArticleCandidate[] {
  const seen = new Set<string>();
  const output: ArticleCandidate[] = [];
  for (const a of articles) {
    const key = normalizeForDedupe(a.url) || a.url.split("#")[0];
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(a);
  }
  return output;
}
