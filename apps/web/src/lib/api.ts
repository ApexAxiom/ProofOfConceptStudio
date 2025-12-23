import { BriefPost, RunWindow } from "@proof/shared";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:3001";

export async function fetchLatest(region: string): Promise<BriefPost[]> {
  const res = await fetch(`${API_BASE_URL}/posts/latest?region=${region}`, { cache: "no-store" });
  if (!res.ok) return [];
  return res.json();
}

export async function fetchPosts(params: { region: string; portfolio?: string; runWindow?: RunWindow; limit?: number }): Promise<BriefPost[]> {
  const query = new URLSearchParams();
  if (params.region) query.set("region", params.region);
  if (params.portfolio) query.set("portfolio", params.portfolio);
  if (params.runWindow) query.set("runWindow", params.runWindow);
  if (params.limit) query.set("limit", String(params.limit));
  const res = await fetch(`${API_BASE_URL}/posts?${query.toString()}`, { cache: "no-store" });
  if (!res.ok) return [];
  return res.json();
}
