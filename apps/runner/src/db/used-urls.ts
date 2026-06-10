import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { RegionSlug, normalizeBriefSources } from "@proof/shared";
import { documentClient, tableName } from "./client.js";
import { normalizeForDedupe } from "../ingest/url-normalize.js";

interface Params {
  portfolio: string;
  region: RegionSlug;
  lookbackDays: number;
  limit?: number;
}

export interface RecentBriefHistory {
  /** Normalized URLs used within `lookbackDays` (hard dedup window). */
  urls: Set<string>;
  /** Selected-article titles used within `titleLookbackDays` (similarity window). */
  titles: string[];
}

const TITLE_LOOKBACK_DAYS = 10;

/**
 * Fetches recently used URLs and article titles for a portfolio/region
 * combination in a single query.
 *
 * URLs use the short lookback window (hard dedup); titles use a longer window
 * so near-duplicate headlines from other outlets can be demoted even after
 * the URL window has rolled over.
 *
 * IMPORTANT: This is category-specific (filters by portfolio). The same article CAN be used
 * across different categories, as each category's AI agent analyzes news from their own
 * domain perspective. This allows cross-category article reuse while preventing duplicates
 * within the same category.
 */
export async function getRecentBriefHistory({ portfolio, region, lookbackDays, limit }: Params): Promise<RecentBriefHistory> {
  const urlWindowDays = Math.max(lookbackDays, 1);
  const queryWindowDays = Math.max(urlWindowDays, TITLE_LOOKBACK_DAYS);

  const since = new Date();
  since.setDate(since.getDate() - queryWindowDays);
  const sinceIso = since.toISOString();

  const urlSince = new Date();
  urlSince.setDate(urlSince.getDate() - urlWindowDays);
  const urlSinceIso = urlSince.toISOString();

  const used = new Set<string>();
  const titles: string[] = [];
  const seenTitles = new Set<string>();
  let lastKey: Record<string, unknown> | undefined;

  do {
    const result = await documentClient.send(
      new QueryCommand({
        TableName: tableName,
        IndexName: "GSI1", // portfolio-date
        KeyConditionExpression: "GSI1PK = :pk AND GSI1SK >= :since",
        ExpressionAttributeValues: {
          ":pk": `PORTFOLIO#${portfolio}`,
          ":since": `DATE#${sinceIso}`,
          ":region": region,
          ":status": "published"
        },
        ExpressionAttributeNames: {
          "#region": "region",
          "#status": "status"
        },
        FilterExpression: "#region = :region AND #status = :status",
        ExclusiveStartKey: lastKey,
        Limit: limit
      })
    );

    for (const item of result.Items ?? []) {
      const publishedAt = typeof item.publishedAt === "string" ? item.publishedAt : "";
      const withinUrlWindow = !publishedAt || publishedAt >= urlSinceIso;

      if (Array.isArray(item.selectedArticles)) {
        for (const article of item.selectedArticles) {
          const title = typeof article?.title === "string" ? article.title.trim() : "";
          if (title) {
            const key = title.toLowerCase();
            if (!seenTitles.has(key)) {
              seenTitles.add(key);
              titles.push(title);
            }
          }
        }
      }

      if (!withinUrlWindow) continue;

      const articleUrls: string[] = Array.isArray(item.selectedArticles)
        ? item.selectedArticles.map((a: any) => a?.url).filter(Boolean)
        : [];
      const sourceUrls: string[] = normalizeBriefSources(item.sources as any).map((source) => source.url);

      for (const url of [...articleUrls, ...sourceUrls]) {
        const normalized = normalizeForDedupe(url as string);
        if (normalized) used.add(normalized);
      }
    }

    lastKey = result.LastEvaluatedKey;
  } while (lastKey && (!limit || used.size < limit));

  return { urls: used, titles };
}

/** @deprecated Use getRecentBriefHistory; kept for compatibility. */
export async function getRecentlyUsedUrls(params: Params): Promise<Set<string>> {
  const history = await getRecentBriefHistory(params);
  return history.urls;
}
