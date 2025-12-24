import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import client from "./dynamo.js";
import { BriefPost, REGION_LIST, MOCK_POSTS } from "@proof/shared";

const tableName = process.env.DDB_TABLE_NAME ?? "CMHub";

function sortByPublished(posts: BriefPost[]): BriefPost[] {
  return [...posts].sort((a, b) => (a.publishedAt > b.publishedAt ? -1 : 1));
}

async function fetchRegionFromDynamo(region: string): Promise<BriefPost[]> {
  const params: any = {
    TableName: tableName,
    IndexName: "GSI2",
    KeyConditionExpression: "GSI2PK = :pk",
    ExpressionAttributeValues: {
      ":pk": `REGION#${region}`
    },
    ScanIndexForward: false,
    Limit: 50
  };
  const data = await client.send(new QueryCommand(params));
  const items = (data.Items ?? []) as BriefPost[];
  return items.filter((i) => i.status === "published");
}

/**
 * Load published briefs for a region, preferring DynamoDB and falling back to curated mock content.
 */
export async function getRegionPosts(region: string): Promise<BriefPost[]> {
  const validRegions = new Set<string>(REGION_LIST.map((r) => r.slug));
  if (!region || !validRegions.has(region)) return [];
  try {
    const live = await fetchRegionFromDynamo(region);
    if (live.length > 0) return sortByPublished(live);
  } catch (err) {
    console.warn("Falling back to mock posts for region", region, (err as Error).message);
  }
  const mock = MOCK_POSTS.filter((p) => p.region === region && p.status === "published");
  return sortByPublished(mock);
}

/**
 * Filter published briefs by portfolio/run window with an optional limit.
 */
export async function filterPosts(params: {
  region: string;
  portfolio?: string;
  runWindow?: string;
  limit?: number;
}): Promise<BriefPost[]> {
  const posts = await getRegionPosts(params.region);
  const filtered = posts.filter(
    (i) =>
      (!params.portfolio || i.portfolio === params.portfolio) &&
      (!params.runWindow || i.runWindow === params.runWindow)
  );
  return typeof params.limit === "number" ? filtered.slice(0, params.limit) : filtered;
}

/**
 * Retrieve a specific brief by ID, returning mock content if live storage is unavailable.
 */
export async function getPost(postId: string): Promise<BriefPost | null> {
  try {
    const params: any = {
      TableName: tableName,
      KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: {
        ":pk": `POST#${postId}`
      },
      ScanIndexForward: false,
      Limit: 1
    };
    const data = await client.send(new QueryCommand(params));
    const found = (data.Items?.[0] as BriefPost) || null;
    if (found) return found;
  } catch (err) {
    console.warn("Falling back to mock post", postId, (err as Error).message);
  }
  return MOCK_POSTS.find((p) => p.postId === postId) ?? null;
}
