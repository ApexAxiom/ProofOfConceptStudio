import { NextResponse } from "next/server";
import { BriefPost, REGION_LIST, getAdminToken, portfolioLabel } from "@proof/shared";
import { filterPosts } from "../../../../lib/server/posts";
import { initializeSecrets } from "../../../../lib/secrets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Aggregated brief-quality report for the admin console: per-portfolio
 * signal levels, usefulness/validation flags, fallback rate, and LLM token
 * spend over the recent window. Turns "AI quality" into numbers.
 */

interface QualityRow {
  portfolio: string;
  portfolioLabel: string;
  briefCount: number;
  signalLevels: { act: number; watch: number; awareness: number; none: number };
  issueCount: number;
  usefulnessIssueCount: number;
  fallbackCount: number;
  totalTokens: number;
  latestPublishedAt: string | null;
  latestPostId: string | null;
  sampleIssues: string[];
}

function emptyRow(portfolio: string): QualityRow {
  return {
    portfolio,
    portfolioLabel: portfolioLabel(portfolio),
    briefCount: 0,
    signalLevels: { act: 0, watch: 0, awareness: 0, none: 0 },
    issueCount: 0,
    usefulnessIssueCount: 0,
    fallbackCount: 0,
    totalTokens: 0,
    latestPublishedAt: null,
    latestPostId: null,
    sampleIssues: []
  };
}

function accumulate(row: QualityRow, brief: BriefPost): void {
  row.briefCount += 1;
  const level = brief.signalLevel ?? "none";
  if (level === "act" || level === "watch" || level === "awareness") row.signalLevels[level] += 1;
  else row.signalLevels.none += 1;

  const issues = brief.qualityReport?.issues ?? [];
  row.issueCount += issues.length;
  const usefulness = issues.filter((issue) => issue.startsWith("usefulness:"));
  row.usefulnessIssueCount += usefulness.length;
  for (const issue of usefulness) {
    if (row.sampleIssues.length < 3 && !row.sampleIssues.includes(issue)) row.sampleIssues.push(issue);
  }

  if (issues.some((issue) => issue.toLowerCase().includes("fallback")) || brief.generationStatus === "generation-failed") {
    row.fallbackCount += 1;
  }
  row.totalTokens += brief.llmUsage?.totalTokens ?? 0;

  if (!row.latestPublishedAt || brief.publishedAt > row.latestPublishedAt) {
    row.latestPublishedAt = brief.publishedAt;
    row.latestPostId = brief.postId;
  }
}

export async function POST(request: Request) {
  await initializeSecrets();
  const body = await request.json().catch(() => ({}));
  const adminToken = typeof body.adminToken === "string" ? body.adminToken.trim() : "";
  if (!adminToken || adminToken !== getAdminToken()) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const region = typeof body.region === "string" && body.region.trim() ? body.region.trim() : "us-mx-la-lng";
  const validRegions = new Set<string>(REGION_LIST.map((item) => item.slug));
  if (!validRegions.has(region)) {
    return NextResponse.json({ error: "region must be a valid RegionSlug" }, { status: 400 });
  }

  const daysRaw = Number(body.days ?? 7);
  const days = Number.isFinite(daysRaw) && daysRaw > 0 ? Math.min(Math.floor(daysRaw), 30) : 7;
  const sinceIso = new Date(Date.now() - days * 86_400_000).toISOString();

  const posts = await filterPosts({ region, limit: 600, includeHidden: true });
  const recent = posts.filter((post) => post.publishedAt >= sinceIso && post.portfolio !== "market-dashboard");

  const rows = new Map<string, QualityRow>();
  for (const brief of recent) {
    if (!brief.portfolio) continue;
    const row = rows.get(brief.portfolio) ?? emptyRow(brief.portfolio);
    accumulate(row, brief);
    rows.set(brief.portfolio, row);
  }

  const rowList = Array.from(rows.values()).sort((a, b) => b.usefulnessIssueCount - a.usefulnessIssueCount);
  const totals = rowList.reduce(
    (acc, row) => {
      acc.briefCount += row.briefCount;
      acc.issueCount += row.issueCount;
      acc.usefulnessIssueCount += row.usefulnessIssueCount;
      acc.fallbackCount += row.fallbackCount;
      acc.totalTokens += row.totalTokens;
      return acc;
    },
    { briefCount: 0, issueCount: 0, usefulnessIssueCount: 0, fallbackCount: 0, totalTokens: 0 }
  );

  return NextResponse.json({ region, days, totals, rows: rowList });
}
