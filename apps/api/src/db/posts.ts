import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import client from "./dynamo.js";
import { BriefPost, REGION_LIST, MOCK_POSTS, getBriefDayKey, normalizeBriefSources } from "@proof/shared";

const tableName = process.env.DDB_TABLE_NAME ?? "CMHub";
const DEFAULT_REGION_FETCH_LIMIT = Number(process.env.POSTS_REGION_FETCH_LIMIT ?? 600);
const DEFAULT_PORTFOLIO_FETCH_LIMIT = Number(process.env.POSTS_PORTFOLIO_FETCH_LIMIT ?? 120);
const QUERY_PAGE_SIZE = Number(process.env.POSTS_QUERY_PAGE_SIZE ?? 100);
const MAX_QUERY_PAGES = Number(process.env.POSTS_MAX_QUERY_PAGES ?? 40);

function sortByPublished(posts: BriefPost[]): BriefPost[] {
  return [...posts].sort((a, b) => (a.publishedAt > b.publishedAt ? -1 : 1));
}

function normalizeBrief(post: BriefPost): BriefPost {
  const briefDay = post.briefDay ?? getBriefDayKey(post.region, new Date(post.publishedAt));
  return {
    ...post,
    briefDay,
    sources: normalizeBriefSources(post.sources)
  };
}

function positiveInt(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.floor(value);
}

async function queryPublishedPosts(params: {
  indexName: "GSI1" | "GSI2";
  keyConditionExpression: string;
  expressionAttributeValues: Record<string, unknown>;
  expressionAttributeNames?: Record<string, string>;
  filterExpression: string;
  limit: number;
}): Promise<BriefPost[]> {
  const limit = positiveInt(params.limit, 50);
  let pages = 0;
  let lastKey: Record<string, unknown> | undefined;
  const items: BriefPost[] = [];

  do {
    const page = await client.send(
      new QueryCommand({
        TableName: tableName,
        IndexName: params.indexName,
        KeyConditionExpression: params.keyConditionExpression,
        ExpressionAttributeValues: params.expressionAttributeValues as Record<string, unknown>,
        ExpressionAttributeNames: params.expressionAttributeNames,
        FilterExpression: params.filterExpression,
        ScanIndexForward: false,
        Limit: positiveInt(QUERY_PAGE_SIZE, 100),
        ExclusiveStartKey: lastKey
      })
    );

    const pageItems = (page.Items ?? []) as BriefPost[];
    for (const item of pageItems) {
      items.push(normalizeBrief(item));
      if (items.length >= limit) {
        return items.slice(0, limit);
      }
    }

    lastKey = page.LastEvaluatedKey as Record<string, unknown> | undefined;
    pages += 1;
  } while (lastKey && pages < positiveInt(MAX_QUERY_PAGES, 40));

  return items.slice(0, limit);
}

async function fetchRegionFromDynamo(region: string, limit = DEFAULT_REGION_FETCH_LIMIT): Promise<BriefPost[]> {
  return queryPublishedPosts({
    indexName: "GSI2",
    keyConditionExpression: "GSI2PK = :pk",
    expressionAttributeValues: {
      ":pk": `REGION#${region}`,
      ":status": "published"
    },
    expressionAttributeNames: {
      "#status": "status"
    },
    filterExpression: "#status = :status",
    limit: positiveInt(limit, DEFAULT_REGION_FETCH_LIMIT)
  });
}

async function fetchPortfolioFromDynamo(params: {
  region: string;
  portfolio: string;
  limit: number;
}): Promise<BriefPost[]> {
  return queryPublishedPosts({
    indexName: "GSI1",
    keyConditionExpression: "GSI1PK = :pk",
    expressionAttributeValues: {
      ":pk": `PORTFOLIO#${params.portfolio}`,
      ":status": "published",
      ":region": params.region
    },
    expressionAttributeNames: {
      "#status": "status",
      "#region": "region"
    },
    filterExpression: "#status = :status AND #region = :region",
    limit: positiveInt(params.limit, DEFAULT_PORTFOLIO_FETCH_LIMIT)
  });
}

export function latestPerPortfolio(posts: BriefPost[]): BriefPost[] {
  const latestByPortfolio = new Map<string, BriefPost>();
  for (const post of sortByPublished(posts)) {
    if (!latestByPortfolio.has(post.portfolio)) {
      latestByPortfolio.set(post.portfolio, post);
    }
  }
  return Array.from(latestByPortfolio.values());
}

/**
 * Load published briefs for a region, preferring DynamoDB and falling back to curated mock content.
 */
export async function getRegionPosts(region: string, limit = DEFAULT_REGION_FETCH_LIMIT): Promise<BriefPost[]> {
  const validRegions = new Set<string>(REGION_LIST.map((r) => r.slug));
  if (!region || !validRegions.has(region)) return [];
  try {
    const live = await fetchRegionFromDynamo(region, limit);
    if (live.length > 0) return sortByPublished(live);
  } catch (err) {
    console.warn("Falling back to mock posts for region", region, (err as Error).message);
  }
  const mock = MOCK_POSTS.filter((p) => p.region === region && p.status === "published").map(normalizeBrief);
  return sortByPublished(mock).slice(0, positiveInt(limit, DEFAULT_REGION_FETCH_LIMIT));
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
  const targetLimit = positiveInt(params.limit ?? 20, 20);
  let posts: BriefPost[] = [];

  if (params.portfolio) {
    try {
      posts = await fetchPortfolioFromDynamo({
        region: params.region,
        portfolio: params.portfolio,
        limit: Math.max(targetLimit, DEFAULT_PORTFOLIO_FETCH_LIMIT)
      });
    } catch (err) {
      console.warn("Falling back to region-scan portfolio query", params.portfolio, (err as Error).message);
      posts = await getRegionPosts(params.region, DEFAULT_REGION_FETCH_LIMIT);
    }
  } else {
    posts = await getRegionPosts(params.region, Math.max(targetLimit, DEFAULT_REGION_FETCH_LIMIT));
  }

  const filtered = posts.filter(
    (i) =>
      (!params.portfolio || i.portfolio === params.portfolio) &&
      (!params.runWindow || i.runWindow === params.runWindow)
  );
  return filtered.slice(0, targetLimit);
}

/**
 * Retrieve a specific brief by ID, returning mock content if live storage is unavailable.
 * Tries the main table PK query first, then falls back to scanning region indexes,
 * and finally checks curated mock content.
 */
export async function getPost(postId: string): Promise<BriefPost | null> {
  // Attempt 1: Direct PK lookup on the main table (fastest path)
  try {
    const data = await client.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: "PK = :pk",
        ExpressionAttributeValues: {
          ":pk": `POST#${postId}`
        },
        ScanIndexForward: false,
        Limit: 1
      })
    );
    const found = (data.Items?.[0] as BriefPost) || null;
    if (found) return normalizeBrief(found);
  } catch (err) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "getPost_pk_query_failed",
        postId,
        error: (err as Error).message
      })
    );
  }

  // Attempt 2: Scan region GSIs to find the post by postId attribute.
  // This covers cases where the PK format has changed or the direct query errored.
  const validRegions = REGION_LIST.map((r: { slug: string }) => r.slug);
  for (const region of validRegions) {
    try {
      const data = await client.send(
        new QueryCommand({
          TableName: tableName,
          IndexName: "GSI2",
          KeyConditionExpression: "GSI2PK = :pk",
          FilterExpression: "postId = :postId",
          ExpressionAttributeValues: {
            ":pk": `REGION#${region}`,
            ":postId": postId
          },
          ScanIndexForward: false,
          Limit: 1
        })
      );
      const found = (data.Items?.[0] as BriefPost) || null;
      if (found) {
        console.warn(
          JSON.stringify({
            level: "warn",
            event: "getPost_found_via_gsi2_fallback",
            postId,
            region
          })
        );
        return normalizeBrief(found);
      }
    } catch (err) {
      console.warn(
        JSON.stringify({
          level: "warn",
          event: "getPost_gsi2_fallback_failed",
          postId,
          region,
          error: (err as Error).message
        })
      );
    }
  }

  // Attempt 3: Curated mock content (development / bootstrapping fallback)
  const fallback = MOCK_POSTS.find((p: BriefPost) => p.postId === postId);
  if (fallback) return normalizeBrief(fallback);

  console.warn(
    JSON.stringify({
      level: "warn",
      event: "getPost_not_found",
      postId
    })
  );
  return null;
}
