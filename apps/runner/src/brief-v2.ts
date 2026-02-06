import { BriefPost, BriefV2NewsStatus, BriefV2TopStory, SelectedArticle } from "@proof/shared";

const FALLBACK_CONTEXT_PREFIX =
  "No material category-specific items detected today; relevant oil & gas context that could affect this category is:";

function normalizeString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeStringArray(values: unknown, maxItems: number): string[] {
  if (!Array.isArray(values)) return [];
  const out: string[] = [];
  for (const value of values) {
    const item = normalizeString(value);
    if (!item || out.includes(item)) continue;
    out.push(item);
    if (out.length >= maxItems) break;
  }
  return out;
}

function normalizedTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function previousStoryTitles(previousBrief?: BriefPost | null): string[] {
  if (!previousBrief) return [];
  const fromTopStories = Array.isArray(previousBrief.topStories)
    ? previousBrief.topStories.map((story) => story.title).filter((title): title is string => typeof title === "string")
    : [];
  if (fromTopStories.length > 0) return fromTopStories.slice(0, 3);
  return (previousBrief.selectedArticles ?? [])
    .map((article) => article.title)
    .filter((title): title is string => typeof title === "string")
    .slice(0, 3);
}

export function buildTopStories(selectedArticles: SelectedArticle[]): BriefV2TopStory[] {
  return selectedArticles.slice(0, 3).map((article, idx) => ({
    sourceArticleIndex: article.sourceIndex ?? idx + 1,
    title: article.title,
    url: article.url,
    sourceName: article.sourceName,
    publishedAt: article.publishedAt,
    briefContent: article.briefContent,
    categoryImportance: article.categoryImportance,
    keyMetrics: article.keyMetrics
  }));
}

export function deriveDeltaSinceLastRun(params: {
  currentDelta?: string[];
  topStories: BriefV2TopStory[];
  previousBrief?: BriefPost | null;
}): string[] {
  const hasPreviousBrief = Boolean(params.previousBrief);
  if (!hasPreviousBrief) return [];

  const providedDelta = normalizeStringArray(params.currentDelta, 3);
  if (providedDelta.length > 0) return providedDelta;

  const currentTitles = params.topStories.map((story) => story.title);
  const previousTitles = previousStoryTitles(params.previousBrief);
  const previousTitleSet = new Set(previousTitles.map((title) => normalizedTitle(title)));
  const bullets: string[] = [];

  if (currentTitles[0] && previousTitles[0] && normalizedTitle(currentTitles[0]) !== normalizedTitle(previousTitles[0])) {
    bullets.push(`Lead coverage shifted from "${previousTitles[0]}" to "${currentTitles[0]}".`);
  }

  for (const title of currentTitles) {
    if (!title) continue;
    if (!previousTitleSet.has(normalizedTitle(title))) {
      bullets.push(`New tracked story in this run: "${title}".`);
      if (bullets.length >= 3) break;
    }
  }

  if (bullets.length === 0) {
    const anchor = currentTitles[0] ?? "current priority signals";
    bullets.push(`Headline mix is broadly consistent with the previous run, anchored on "${anchor}".`);
  }

  return bullets.slice(0, 3);
}

export function buildContextNote(categoryLabel: string, topStories: BriefV2TopStory[], newsStatus: BriefV2NewsStatus): string | undefined {
  if (newsStatus === "ok") return undefined;

  const contextSummary = topStories
    .map((story) => {
      const source = story.sourceName ? ` (${story.sourceName})` : "";
      return `${story.title}${source}`;
    })
    .join("; ");

  const suffix = contextSummary
    ? `${contextSummary}. Procurement implication: keep supplier-risk monitoring active, maintain contract flexibility, and use index-linked guardrails until category-specific volume improves.`
    : "broader upstream and supply-chain coverage from trusted sources. Procurement implication: preserve optionality in supplier plans and contract terms until category-specific flow strengthens.";

  return `${FALLBACK_CONTEXT_PREFIX} ${suffix}`;
}

export function normalizeNewsStatus(
  requestedStatus: BriefV2NewsStatus,
  topStories: BriefV2TopStory[]
): BriefV2NewsStatus {
  if (requestedStatus === "ok" && topStories.length < 2) {
    return "thin-category";
  }
  return requestedStatus;
}

