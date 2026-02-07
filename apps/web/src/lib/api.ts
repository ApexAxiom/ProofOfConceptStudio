import { BriefPost, PORTFOLIOS, RunWindow, MOCK_POSTS } from "@proof/shared";
import { getApiBaseUrl } from "./api-base";

function sortByPublished(posts: BriefPost[]): BriefPost[] {
  return [...posts].sort((a, b) => (a.publishedAt > b.publishedAt ? -1 : 1));
}

function filterMockPosts(params: {
  region: string;
  portfolio?: string;
  runWindow?: RunWindow;
  limit?: number;
}): BriefPost[] {
  const filtered = MOCK_POSTS.filter(
    (p) =>
      p.status === "published" &&
      p.region === params.region &&
      (!params.portfolio || p.portfolio === params.portfolio) &&
      (!params.runWindow || p.runWindow === params.runWindow)
  );
  const sorted = sortByPublished(filtered);
  return typeof params.limit === "number" ? sorted.slice(0, params.limit) : sorted;
}

function getMockPost(postId: string): BriefPost | null {
  return MOCK_POSTS.find((p) => p.postId === postId) ?? null;
}

/**
 * Fetch the newest briefs for a region, returning curated mock posts when the API is unavailable.
 */
export async function fetchLatest(region: string): Promise<BriefPost[]> {
  try {
    const apiBaseUrl = await getApiBaseUrl();
    const res = await fetch(`${apiBaseUrl}/posts/latest?region=${region}`, { cache: "no-store" });
    if (!res.ok) return filterMockPosts({ region, limit: 30 });
    return res.json();
  } catch {
    return filterMockPosts({ region, limit: 30 });
  }
}

/**
 * Fetch briefs filtered by region and optional portfolio/run window, with mock fallbacks when the API errors.
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
    if (!res.ok) return filterMockPosts(params);
    return res.json();
  } catch {
    return filterMockPosts(params);
  }
}

function pickLatestPerPortfolio(briefs: BriefPost[]): BriefPost[] {
  const latestByPortfolio = new Map<string, BriefPost>();
  for (const brief of briefs) {
    if (!latestByPortfolio.has(brief.portfolio)) {
      latestByPortfolio.set(brief.portfolio, brief);
    }
  }
  return PORTFOLIOS.map((p) => latestByPortfolio.get(p.slug)).filter(Boolean) as BriefPost[];
}

/**
 * Fetch the latest brief for each portfolio in a region, using mock posts when the API is unreachable.
 */
export async function fetchLatestByPortfolio(region: string): Promise<BriefPost[]> {
  try {
    const apiBaseUrl = await getApiBaseUrl();
    const res = await fetch(`${apiBaseUrl}/posts/latest-by-portfolio?region=${region}`, { cache: "no-store" });
    if (!res.ok) {
      const posts = await fetchPosts({ region, limit: 400 });
      return pickLatestPerPortfolio(posts);
    }
    const posts = (await res.json()) as BriefPost[];
    return pickLatestPerPortfolio(posts);
  } catch {
    const posts = await fetchPosts({ region, limit: 400 });
    return pickLatestPerPortfolio(posts);
  }
}

/**
 * Fetch a single brief by id, falling back to bundled mock content if necessary.
 * Validates the response body to avoid treating an API 200-with-null as a found post.
 */
export async function fetchPost(postId: string): Promise<BriefPost | null> {
  try {
    const apiBaseUrl = await getApiBaseUrl();
    const res = await fetch(`${apiBaseUrl}/posts/${postId}`, { cache: "no-store" });
    if (!res.ok) {
      // API explicitly said "not found" or errored — try mock
      return getMockPost(postId);
    }
    const data = await res.json();
    // Guard against API returning null/empty with 200 status
    if (!data || typeof data !== "object" || !data.postId) {
      return getMockPost(postId);
    }
    return data as BriefPost;
  } catch {
    return getMockPost(postId);
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

  return getMockPost(postId);
}
