import { BriefPost, MOCK_POSTS, getBriefDayKey, portfolioLabel, upgradeBriefToNewFormat } from "@proof/shared";

function titleCaseFromSlug(value: string): string {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function fallbackSelectedArticles(brief: BriefPost): NonNullable<BriefPost["selectedArticles"]> {
  const firstSource =
    typeof brief.sources?.[0] === "string"
      ? brief.sources[0]
      : brief.sources?.[0] && typeof brief.sources[0] === "object"
        ? brief.sources[0].url
        : undefined;
  const url = firstSource ?? `https://example.com/${brief.portfolio}/${brief.postId}`;
  return [
    {
      title: brief.title,
      url,
      briefContent: brief.summary ?? brief.bodyMarkdown.slice(0, 220),
      categoryImportance: `New layout preview for ${portfolioLabel(brief.portfolio)} sourcing decisions.`,
      sourceName: titleCaseFromSlug(brief.portfolio)
    }
  ];
}

function withTodayMetadata(brief: BriefPost): BriefPost {
  const publishedAt = new Date().toISOString();
  return {
    ...brief,
    publishedAt,
    briefDay: getBriefDayKey(brief.region, new Date(publishedAt)),
    selectedArticles: brief.selectedArticles?.length ? brief.selectedArticles : fallbackSelectedArticles(brief)
  };
}

export function getTodayPreviewBriefs(): BriefPost[] {
  return MOCK_POSTS
    .map(withTodayMetadata)
    .map((brief) => upgradeBriefToNewFormat(brief))
    .sort((a, b) => {
      if (a.region !== b.region) return a.region.localeCompare(b.region);
      return portfolioLabel(a.portfolio).localeCompare(portfolioLabel(b.portfolio));
    });
}
