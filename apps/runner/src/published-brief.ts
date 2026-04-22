import {
  AgentConfig,
  BriefPost,
  BriefV2NewsStatus,
  BriefV2TopStory,
  makeCategoryPlaceholderDataUrl
} from "@proof/shared";
import { buildContextNote, buildTopStories, deriveDeltaSinceLastRun, normalizeNewsStatus } from "./brief-v2.js";

export function finalizePublishedBrief(params: {
  brief: BriefPost;
  agent: AgentConfig;
  newsStatus: BriefV2NewsStatus;
  previousBrief?: BriefPost | null;
  nowIso: string;
  postId: string;
  runKey: string;
  briefDay: string;
}): BriefPost {
  const topStories: BriefV2TopStory[] =
    params.brief.topStories && params.brief.topStories.length > 0
      ? params.brief.topStories
      : buildTopStories(params.brief.selectedArticles ?? []);
  const normalizedStatus = normalizeNewsStatus(params.brief.newsStatus ?? params.newsStatus, topStories);
  const deltaSinceLastRun = deriveDeltaSinceLastRun({
    currentDelta: params.brief.deltaSinceLastRun,
    topStories,
    previousBrief: params.previousBrief
  });
  const firstImage = params.brief.selectedArticles?.find((article) => article.imageUrl);
  const heroImageUrl =
    params.brief.heroImage?.url ??
    params.brief.heroImageUrl ??
    firstImage?.imageUrl ??
    makeCategoryPlaceholderDataUrl(params.agent.label);
  const heroImageAlt =
    params.brief.heroImage?.alt ??
    params.brief.heroImageAlt ??
    firstImage?.imageAlt ??
    firstImage?.title ??
    params.brief.title;

  return {
    ...params.brief,
    postId: params.postId,
    runKey: params.runKey,
    agentId: params.agent.id,
    briefDay: params.briefDay,
    publishedAt: params.nowIso,
    generationStatus: "published",
    status: "published",
    version: "v2",
    topStories,
    heroImage: {
      url: heroImageUrl,
      alt: heroImageAlt,
      sourceArticleIndex:
        params.brief.heroImage?.sourceArticleIndex ?? firstImage?.sourceIndex ?? topStories[0]?.sourceArticleIndex ?? 1
    },
    heroImageUrl,
    heroImageAlt,
    heroImageSourceUrl:
      params.brief.heroImageSourceUrl ??
      firstImage?.url ??
      params.brief.selectedArticles?.[0]?.url,
    newsStatus: normalizedStatus,
    deltaSinceLastRun,
    contextNote: buildContextNote(params.agent.label, topStories, normalizedStatus)
  };
}
