import { BriefPost, PORTFOLIOS, RunWindow, isUserVisiblePlaceholderBrief } from "@proof/shared";
import { getApiBaseUrl } from "./api-base";

function sortByPublished(posts: BriefPost[]): BriefPost[] {
  return [...posts].sort((a, b) => (a.publishedAt > b.publishedAt ? -1 : 1));
}

function filterVisibleBriefs(posts: BriefPost[]): BriefPost[] {
  return posts.filter((post) => !isUserVisiblePlaceholderBrief(post));
}

/**
 * Fetch the newest briefs for a region.
 */
export async function fetchLatest(region: string): Promise<BriefPost[]> {
  try {
    const apiBaseUrl = await getApiBaseUrl();
    const res = await fetch(`${apiBaseUrl}/posts/latest?region=${region}`, { cache: "no-store" });
    if (!res.ok) return [];
    const posts = (await res.json()) as BriefPost[];
    return sortByPublished(filterVisibleBriefs(posts)).slice(0, 30);
  } catch {
    return [];
  }
}

/**
 * Fetch briefs filtered by region and optional portfolio/run window.
 */
export async function fetchPosts(params: {
  region: string;
  portfolio?: string;
  runWindow?: RunWindow;
  limit?: number;
  }): Promise<BriefPost[]> {
  try {
    const apiBaseUrl = await getApiBaseUrl();
    const query = new URLSearchParams();
    if (params.region) query.set("region", params.region);
    if (params.portfolio) query.set("portfolio", params.portfolio);
    if (params.runWindow) query.set("runWindow", params.runWindow);
    if (params.limit) query.set("limit", String(params.limit));
    const res = await fetch(`${apiBaseUrl}/posts?${query.toString()}`, { cache: "no-store" });
    if (!res.ok) return [];
    const posts = (await res.json()) as BriefPost[];
    const filtered = filterVisibleBriefs(posts);
    const sorted = sortByPublished(filtered);
    return typeof params.limit === "number" ? sorted.slice(0, params.limit) : sorted;
  } catch {
    return [];
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
export async function fetchLatestByPortfolio(region: string): Promise<BriefPost[]> {
  try {
    const apiBaseUrl = await getApiBaseUrl();
    const res = await fetch(`${apiBaseUrl}/posts/latest-by-portfolio?region=${region}`, { cache: "no-store" });
    if (!res.ok) {
      const posts = await fetchPosts({ region, limit: 400 });
      return pickLatestPerPortfolio(posts);
    }
    const posts = filterVisibleBriefs((await res.json()) as BriefPost[]);
    return pickLatestPerPortfolio(posts);
  } catch {
    const posts = await fetchPosts({ region, limit: 400 });
    return pickLatestPerPortfolio(posts);
  }
}

/**
 * Fetch a single brief by id.
 * Validates the response body to avoid treating an API 200-with-null as a found post.
 */
export async function fetchPost(postId: string): Promise<BriefPost | null> {
  try {
    const apiBaseUrl = await getApiBaseUrl();
    // postId contains "#" (e.g. `brief_YYYY-MM-DD#region#agentId`), so it must be URL-encoded.
    const encodedPostId = encodeURIComponent(postId);
    const res = await fetch(`${apiBaseUrl}/posts/${encodedPostId}`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    // Guard against API returning null/empty with 200 status
    if (!data || typeof data !== "object" || !data.postId) {
      return null;
    }
    const brief = data as BriefPost;
    return isUserVisiblePlaceholderBrief(brief) ? null : brief;
  } catch {
    return null;
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
