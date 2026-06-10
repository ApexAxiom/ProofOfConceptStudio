import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import {
  BriefPost,
  BriefSignalLevel,
  RegionSlug,
  isUserVisiblePlaceholderBrief,
  portfolioLabel,
  regionLabel
} from "@proof/shared";
import { documentClient, tableName } from "../db/client.js";

/**
 * Daily email digest: one row per category with its signal level and
 * headline, so a category manager can triage from their inbox.
 */

export interface DigestEntry {
  portfolio: string;
  portfolioLabel: string;
  postId: string;
  title: string;
  summaryLine: string;
  signalLevel?: BriefSignalLevel;
  publishedAt: string;
}

export interface RegionDigest {
  region: RegionSlug;
  regionLabel: string;
  generatedAt: string;
  entries: DigestEntry[];
  actCount: number;
  watchCount: number;
  awarenessCount: number;
}

const EXCLUDED_PORTFOLIOS = new Set(["market-dashboard"]);

function stripCitationTags(text: string): string {
  return text
    .replace(/\[\d+\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function summaryLineFor(brief: BriefPost): string {
  const candidate = brief.decisionSummary?.topMove || brief.summary || brief.highlights?.[0] || "";
  const cleaned = stripCitationTags(candidate);
  return cleaned.length > 220 ? `${cleaned.slice(0, 217).trimEnd()}...` : cleaned;
}

function signalRank(level?: BriefSignalLevel): number {
  return level === "act" ? 0 : level === "watch" ? 1 : level === "awareness" ? 2 : 3;
}

/**
 * Pure assembly from a brief list — unit-testable without DynamoDB.
 * Picks the latest brief per portfolio and orders rows by signal severity.
 */
export function buildDigestFromBriefs(region: RegionSlug, briefs: BriefPost[], nowIso: string): RegionDigest | null {
  const latestByPortfolio = new Map<string, BriefPost>();
  const sorted = [...briefs].sort((a, b) => (a.publishedAt > b.publishedAt ? -1 : 1));
  for (const brief of sorted) {
    if (!brief.portfolio || EXCLUDED_PORTFOLIOS.has(brief.portfolio)) continue;
    if (isUserVisiblePlaceholderBrief(brief)) continue;
    if (!latestByPortfolio.has(brief.portfolio)) {
      latestByPortfolio.set(brief.portfolio, brief);
    }
  }

  const entries: DigestEntry[] = Array.from(latestByPortfolio.values())
    .map((brief) => ({
      portfolio: brief.portfolio,
      portfolioLabel: portfolioLabel(brief.portfolio),
      postId: brief.postId,
      title: stripCitationTags(brief.title),
      summaryLine: summaryLineFor(brief),
      signalLevel: brief.signalLevel,
      publishedAt: brief.publishedAt
    }))
    .sort(
      (a, b) => signalRank(a.signalLevel) - signalRank(b.signalLevel) || a.portfolioLabel.localeCompare(b.portfolioLabel)
    );

  if (entries.length === 0) return null;

  return {
    region,
    regionLabel: regionLabel(region),
    generatedAt: nowIso,
    entries,
    actCount: entries.filter((entry) => entry.signalLevel === "act").length,
    watchCount: entries.filter((entry) => entry.signalLevel === "watch").length,
    awarenessCount: entries.filter((entry) => entry.signalLevel === "awareness").length
  };
}

/**
 * Queries the region's briefs published in the last `lookbackHours` and
 * assembles the digest. Returns null when nothing publishable exists.
 */
export async function buildRegionDigest(params: {
  region: RegionSlug;
  nowIso: string;
  lookbackHours?: number;
}): Promise<RegionDigest | null> {
  const lookbackHours = params.lookbackHours ?? 30;
  const since = new Date(new Date(params.nowIso).getTime() - lookbackHours * 3_600_000).toISOString();

  const query = await documentClient.send(
    new QueryCommand({
      TableName: tableName,
      IndexName: "GSI2",
      KeyConditionExpression: "GSI2PK = :pk AND GSI2SK >= :since",
      ExpressionAttributeValues: {
        ":pk": `REGION#${params.region}`,
        ":since": `DATE#${since}`,
        ":status": "published"
      },
      ExpressionAttributeNames: { "#status": "status" },
      FilterExpression: "#status = :status"
    })
  );

  return buildDigestFromBriefs(params.region, (query.Items ?? []) as BriefPost[], params.nowIso);
}
