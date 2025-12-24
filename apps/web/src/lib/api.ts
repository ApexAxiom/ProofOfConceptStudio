import { BriefPost, PORTFOLIOS, RunWindow } from "@proof/shared";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:3001";

export async function fetchLatest(region: string): Promise<BriefPost[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/posts/latest?region=${region}`, { cache: "no-store" });
    if (!res.ok) return [];
    return res.json();
  } catch {
    // If API_BASE_URL isn't configured (common in App Runner) or the API is down,
    // avoid crashing SSR/health checks by returning an empty list.
    return [];
  }
}

export async function fetchPosts(params: { region: string; portfolio?: string; runWindow?: RunWindow; limit?: number }): Promise<BriefPost[]> {
  try {
    const query = new URLSearchParams();
    if (params.region) query.set("region", params.region);
    if (params.portfolio) query.set("portfolio", params.portfolio);
    if (params.runWindow) query.set("runWindow", params.runWindow);
    if (params.limit) query.set("limit", String(params.limit));
    const res = await fetch(`${API_BASE_URL}/posts?${query.toString()}`, { cache: "no-store" });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
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

export async function fetchLatestByPortfolio(region: string): Promise<BriefPost[]> {
  const posts = await fetchPosts({ region, limit: 200 });
  return pickLatestPerPortfolio(posts);
}

export async function fetchPost(postId: string): Promise<BriefPost | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/posts/${postId}`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
