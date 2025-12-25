import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { RegionSlug } from "@proof/shared";
import { documentClient, tableName } from "./client.js";
import { normalizeForDedupe } from "../ingest/url-normalize.js";

interface Params {
  portfolio: string;
  region: RegionSlug;
  lookbackDays: number;
  limit?: number;
}

/**
 * Fetches recently used URLs for a portfolio/region combination to avoid reusing articles.
 */
export async function getRecentlyUsedUrls({ portfolio, region, lookbackDays, limit }: Params): Promise<Set<string>> {
  const since = new Date();
  since.setDate(since.getDate() - Math.max(lookbackDays, 1));
  const sinceIso = since.toISOString();

  const used = new Set<string>();
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
      const articleUrls: string[] = Array.isArray(item.selectedArticles)
        ? item.selectedArticles.map((a: any) => a?.url).filter(Boolean)
        : [];
      const sourceUrls: string[] = Array.isArray(item.sources) ? item.sources.filter(Boolean) : [];

      for (const url of [...articleUrls, ...sourceUrls]) {
        const normalized = normalizeForDedupe(url as string);
        if (normalized) used.add(normalized);
      }
    }

    lastKey = result.LastEvaluatedKey;
  } while (lastKey && (!limit || used.size < limit));

  return used;
}
