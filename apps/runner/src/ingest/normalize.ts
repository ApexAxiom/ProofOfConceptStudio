import crypto from "node:crypto";
import { ArticleCandidate } from "./fetch.js";

export function normalizeArticle(article: ArticleCandidate) {
  const hash = crypto.createHash("sha256").update(article.url).digest("hex");
  return { ...article, hash };
}
