import { SelectedArticle } from "@proof/shared";

/**
 * Selects the hero article by matching the source index from the original input list.
 */
export function selectHeroArticle(
  selectedArticles: SelectedArticle[],
  heroSourceIndex: number
): SelectedArticle | undefined {
  return selectedArticles.find((article) => article.sourceIndex === heroSourceIndex) ?? selectedArticles[0];
}
