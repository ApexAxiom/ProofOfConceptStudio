import { unstable_cache } from "next/cache";
import { BriefPost, PORTFOLIOS, RunWindow, isUserVisiblePlaceholderBrief } from "@proof/shared";
import { filterPosts, getPost, getRegionPosts } from "./server/posts";

const BRIEF_LIST_REVALIDATE_SECONDS = 60;
const BRIEF_DETAIL_REVALIDATE_SECONDS = 300;

function isIncrementalCacheUnavailable(error: unknown): boolean {
  return error instanceof Error && error.message.includes("incrementalCache missing");
}

function sortByPublished(posts: BriefPost[]): BriefPost[] {
  return [...posts].sort((a, b) => (a.publishedAt > b.publishedAt ? -1 : 1));
}

function filterVisibleBriefs(posts: BriefPost[]): BriefPost[] {
  return posts.filter((post) => !isUserVisiblePlaceholderBrief(post));
}

/**
 * Fetch the newest briefs for a region.
 */
const fetchLatestCached = unstable_cache(
  async (region: string): Promise<BriefPost[]> => {
    try {
      const posts = await getRegionPosts(region, 120);
      return sortByPublished(filterVisibleBriefs(posts)).slice(0, 30);
    } catch {
      return [];
    }
  },
  ["web-fetch-latest"],
  { revalidate: BRIEF_LIST_REVALIDATE_SECONDS }
);

export async function fetchLatest(region: string): Promise<BriefPost[]> {
  try {
    return await fetchLatestCached(region);
  } catch (error) {
    if (isIncrementalCacheUnavailable(error)) {
      const posts = await getRegionPosts(region, 120);
      return sortByPublished(filterVisibleBriefs(posts)).slice(0, 30);
    }
    throw error;
  }
}

/**
 * Fetch briefs filtered by region and optional portfolio/run window.
 */
const fetchPostsCached = unstable_cache(
  async (
    region: string,
    portfolio: string | undefined,
    runWindow: RunWindow | undefined,
    limit: number | undefined
  ): Promise<BriefPost[]> => {
    try {
      const posts = await filterPosts({
        region,
        portfolio,
        runWindow,
        limit
      });
      const filtered = filterVisibleBriefs(posts);
      const sorted = sortByPublished(filtered);
      return typeof limit === "number" ? sorted.slice(0, limit) : sorted;
    } catch {
      return [];
    }
  },
  ["web-fetch-posts"],
  { revalidate: BRIEF_LIST_REVALIDATE_SECONDS }
);

export async function fetchPosts(params: {
  region: string;
  portfolio?: string;
  runWindow?: RunWindow;
  limit?: number;
}): Promise<BriefPost[]> {
  try {
    return await fetchPostsCached(params.region, params.portfolio, params.runWindow, params.limit);
  } catch (error) {
    if (isIncrementalCacheUnavailable(error)) {
      const posts = await filterPosts({
        region: params.region,
        portfolio: params.portfolio,
        runWindow: params.runWindow,
        limit: params.limit
      });
      const filtered = filterVisibleBriefs(posts);
      const sorted = sortByPublished(filtered);
      return typeof params.limit === "number" ? sorted.slice(0, params.limit) : sorted;
    }
    throw error;
  }
}

function pickLatestPerPortfolio(briefs: BriefPost[]): BriefPost[] {
  const latestByPortfolio = new Map<string, BriefPost>();
  for (const brief of sortByPublished(filterVisibleBriefs(briefs))) {
    if (!latestByPortfolio.has(brief.portfolio)) {
      latestByPortfolio.set(brief.portfolio, brief);
    }
  }
  return PORTFOLIOS.map((p) => latestByPortfolio.get(p.slug)).filter(Boolean) as BriefPost[];
}

/**
 * Fetch the latest brief for each portfolio in a region.
 */
const fetchLatestByPortfolioCached = unstable_cache(
  async (region: string): Promise<BriefPost[]> => {
    try {
      const posts = filterVisibleBriefs(await getRegionPosts(region, 800));
      return pickLatestPerPortfolio(posts);
    } catch {
      const posts = await fetchPosts({ region, limit: 400 });
      return pickLatestPerPortfolio(posts);
    }
  },
  ["web-fetch-latest-by-portfolio"],
  { revalidate: BRIEF_LIST_REVALIDATE_SECONDS }
);

export async function fetchLatestByPortfolio(region: string): Promise<BriefPost[]> {
  try {
    return await fetchLatestByPortfolioCached(region);
  } catch (error) {
    if (isIncrementalCacheUnavailable(error)) {
      const posts = filterVisibleBriefs(await getRegionPosts(region, 800));
      return pickLatestPerPortfolio(posts);
    }
    throw error;
  }
}

/**
 * Fetch a single brief by id.
 * Validates the response body to avoid treating an API 200-with-null as a found post.
 */
const fetchPostCached = unstable_cache(
  async (postId: string): Promise<BriefPost | null> => {
    try {
      const brief = await getPost(postId);
      if (!brief || typeof brief !== "object" || !brief.postId) {
        return null;
      }
      return isUserVisiblePlaceholderBrief(brief) ? null : brief;
    } catch {
      return null;
    }
  },
  ["web-fetch-post"],
  { revalidate: BRIEF_DETAIL_REVALIDATE_SECONDS }
);

export async function fetchPost(postId: string): Promise<BriefPost | null> {
  try {
    return await fetchPostCached(postId);
  } catch (error) {
    if (isIncrementalCacheUnavailable(error)) {
      const brief = await getPost(postId);
      if (!brief || typeof brief !== "object" || !brief.postId) {
        return null;
      }
      return isUserVisiblePlaceholderBrief(brief) ? null : brief;
    }
    throw error;
  }
}

/**
 * Fetch a single brief by id, trying the region GSIs as a secondary lookup.
 * This provides a resilient fallback when the primary PK query fails.
 */
export async function fetchPostWithFallback(postId: string): Promise<BriefPost | null> {
  // Primary: direct post lookup
  const post = await fetchPost(postId);
  if (post) return post;

  // Secondary: search through latest briefs from both regions to find the post.
  // This handles edge cases where the API's PK lookup fails but the post exists in a GSI.
  try {
    const [auBriefs, intlBriefs] = await Promise.all([
      fetchLatest("au"),
      fetchLatest("us-mx-la-lng")
    ]);
    const allBriefs = [...auBriefs, ...intlBriefs];
    const match = allBriefs.find((brief) => brief.postId === postId);
    if (match) return match;
  } catch {
    // Ignore — we already tried the primary path
  }

  return null;
}
