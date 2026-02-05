import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { BriefPost, RegionSlug } from "@proof/shared";
import { documentClient, tableName } from "../db/client.js";

interface FetchOptions {
  limit?: number;
  region?: RegionSlug;
}

export interface DynamoBriefItem extends BriefPost {
  PK: string;
  SK: string;
  GSI1PK: string;
  GSI1SK: string;
  GSI2PK: string;
  GSI2SK: string;
  GSI3PK: string;
  GSI3SK: string;
  ttl?: number;
  runId?: string;
}

function stripUndefined<T>(value: T): T {
  if (value === undefined || value === null) return value;
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefined(item)) as T;
  }
  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const stripped = stripUndefined(child);
      if (stripped !== undefined) output[key] = stripped;
    }
    return output as T;
  }
  return value;
}

export async function fetchPublishedBriefItems(options: FetchOptions = {}): Promise<DynamoBriefItem[]> {
  const limit = options.limit ?? 5_000;
  const items: DynamoBriefItem[] = [];
  let lastKey: Record<string, unknown> | undefined;

  do {
    const page = await documentClient.send(
      new QueryCommand({
        TableName: tableName,
        IndexName: "GSI3",
        KeyConditionExpression: "GSI3PK = :status",
        ExpressionAttributeValues: {
          ":status": "STATUS#published",
          ...(options.region ? { ":region": options.region } : {})
        },
        ...(options.region
          ? {
              ExpressionAttributeNames: { "#region": "region" },
              FilterExpression: "#region = :region"
            }
          : {}),
        ScanIndexForward: false,
        Limit: 100,
        ExclusiveStartKey: lastKey
      })
    );

    const pageItems = (page.Items ?? []) as DynamoBriefItem[];
    for (const item of pageItems) {
      items.push(item);
      if (items.length >= limit) return items;
    }

    lastKey = page.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);

  return items;
}

export async function putBriefItem(item: DynamoBriefItem): Promise<void> {
  const clean = stripUndefined(item);
  await documentClient.send(
    new PutCommand({
      TableName: tableName,
      Item: clean as unknown as Record<string, unknown>
    })
  );
}
