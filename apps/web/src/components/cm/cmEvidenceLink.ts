import { BriefPost } from "@proof/shared";

/**
 * Builds a deep link back to the source article within a brief using the evidence index.
 */
export function cmEvidenceLink(brief: BriefPost | undefined, evidenceArticleIndex?: number): string {
  if (!brief) return "/brief";

  const baseHref = `/brief/${encodeURIComponent(brief.postId)}`;
  if (!brief.selectedArticles || evidenceArticleIndex === undefined) return baseHref;

  const position = brief.selectedArticles.findIndex((article) => article.sourceIndex === evidenceArticleIndex);
  if (position >= 0) {
    return `${baseHref}#article-${position + 1}`;
  }

  return baseHref;
}
