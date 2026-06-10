import { BatchWriteCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { documentClient, tableName } from "./client.js";
import type { MarketDataPoint, MarketHistoryProvider } from "../market/history/types.js";

/**
 * Daily market data history in the shared table:
 *   PK = MARKET#<seriesId>, SK = DAY#<YYYY-MM-DD>
 * One item per series per observation day; re-runs overwrite idempotently.
 */

const RETENTION_DAYS = 450;
const BATCH_SIZE = 25;

export function marketHistoryKeys(seriesId: string, day: string) {
  return { PK: `MARKET#${seriesId}`, SK: `DAY#${day}` };
}

export function buildMarketHistoryItem(point: MarketDataPoint) {
  return {
    ...marketHistoryKeys(point.seriesId, point.day),
    itemType: "market_data_point",
    seriesId: point.seriesId,
    day: point.day,
    value: point.value,
    unit: point.unit,
    provider: point.provider,
    sourceUrl: point.sourceUrl,
    fetchedAt: point.fetchedAt,
    ttl: Math.floor(Date.parse(`${point.day}T00:00:00.000Z`) / 1000) + RETENTION_DAYS * 24 * 60 * 60
  };
}

export async function putMarketHistoryPoints(points: MarketDataPoint[]): Promise<number> {
  let written = 0;
  for (let offset = 0; offset < points.length; offset += BATCH_SIZE) {
    const batch = points.slice(offset, offset + BATCH_SIZE);
    await documentClient.send(
      new BatchWriteCommand({
        RequestItems: {
          [tableName]: batch.map((point) => ({ PutRequest: { Item: buildMarketHistoryItem(point) } }))
        }
      })
    );
    written += batch.length;
  }
  return written;
}

export async function getMarketHistory(params: {
  seriesId: string;
  sinceDay: string;
}): Promise<MarketDataPoint[]> {
  const points: MarketDataPoint[] = [];
  let lastKey: Record<string, unknown> | undefined;

  do {
    const result = await documentClient.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: "PK = :pk AND SK >= :since",
        ExpressionAttributeValues: {
          ":pk": `MARKET#${params.seriesId}`,
          ":since": `DAY#${params.sinceDay}`
        },
        ExclusiveStartKey: lastKey
      })
    );

    for (const item of result.Items ?? []) {
      if (typeof item.day !== "string" || typeof item.value !== "number" || !Number.isFinite(item.value)) {
        continue;
      }
      points.push({
        seriesId: params.seriesId,
        day: item.day,
        value: item.value,
        unit: typeof item.unit === "string" ? item.unit : "",
        provider: (item.provider ?? "eia") as MarketHistoryProvider,
        sourceUrl: typeof item.sourceUrl === "string" ? item.sourceUrl : "",
        fetchedAt: typeof item.fetchedAt === "string" ? item.fetchedAt : ""
      });
    }
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  return points.sort((a, b) => a.day.localeCompare(b.day));
}
