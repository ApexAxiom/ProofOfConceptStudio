import { BriefPost, PORTFOLIOS, RunWindow, MOCK_POSTS } from "@proof/shared";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:3001";

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
    const res = await fetch(`${API_BASE_URL}/posts/latest?region=${region}`, { cache: "no-store" });
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
    const query = new URLSearchParams();
    if (params.region) query.set("region", params.region);
    if (params.portfolio) query.set("portfolio", params.portfolio);
    if (params.runWindow) query.set("runWindow", params.runWindow);
    if (params.limit) query.set("limit", String(params.limit));
    const res = await fetch(`${API_BASE_URL}/posts?${query.toString()}`, { cache: "no-store" });
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
  const posts = await fetchPosts({ region, limit: 200 });
  return pickLatestPerPortfolio(posts);
}

/**
 * Fetch a single brief by id, falling back to bundled mock content if necessary.
 */
export async function fetchPost(postId: string): Promise<BriefPost | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/posts/${postId}`, { cache: "no-store" });
    if (!res.ok) return getMockPost(postId);
    return res.json();
  } catch {
    return getMockPost(postId);
  }
}
