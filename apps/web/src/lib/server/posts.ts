import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import {
  BriefPost,
  REGION_LIST,
  getBriefDayKey,
  isUserVisiblePlaceholderBrief,
  normalizeBriefSources
} from "@proof/shared";
import { getDynamoDocumentClient, getDynamoTableName } from "./dynamo";

const DEFAULT_REGION_FETCH_LIMIT = Number(process.env.POSTS_REGION_FETCH_LIMIT ?? 600);
const DEFAULT_PORTFOLIO_FETCH_LIMIT = Number(process.env.POSTS_PORTFOLIO_FETCH_LIMIT ?? 120);
const QUERY_PAGE_SIZE = Number(process.env.POSTS_QUERY_PAGE_SIZE ?? 100);
const MAX_QUERY_PAGES = Number(process.env.POSTS_MAX_QUERY_PAGES ?? 40);

function sortByPublished(posts: BriefPost[]): BriefPost[] {
  return [...posts].sort((a, b) => (a.publishedAt > b.publishedAt ? -1 : 1));
}

function normalizeBrief(post: BriefPost): BriefPost {
  const briefDay = post.briefDay ?? getBriefDayKey(post.region, new Date(post.publishedAt));
  const normalizedStatus: BriefPost["status"] =
    post.status === "published" || post.status === "draft" || post.status === "failed"
      ? post.status
      : post.generationStatus === "published"
        ? "published"
        : "draft";

  return {
    ...post,
    status: normalizedStatus,
    briefDay,
    sources: normalizeBriefSources(post.sources)
  };
}

function keepUserVisibleBrief(post: BriefPost, includeHidden = false): boolean {
  if (post.status !== "published" && post.generationStatus !== "published") return false;
  if (includeHidden) return true;
  return !isUserVisiblePlaceholderBrief(post);
}

function positiveInt(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.floor(value);
}

async function queryPublishedPosts(params: {
  includeHidden?: boolean;
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
  const [client, tableName] = await Promise.all([getDynamoDocumentClient(), getDynamoTableName()]);

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
      const normalized = normalizeBrief(item);
      if (!keepUserVisibleBrief(normalized, params.includeHidden)) continue;
      items.push(normalized);
      if (items.length >= limit) {
        return items.slice(0, limit);
      }
    }

    lastKey = page.LastEvaluatedKey as Record<string, unknown> | undefined;
    pages += 1;
  } while (lastKey && pages < positiveInt(MAX_QUERY_PAGES, 40));

  return items.slice(0, limit);
}

async function fetchRegionFromDynamo(region: string, limit = DEFAULT_REGION_FETCH_LIMIT, includeHidden = false): Promise<BriefPost[]> {
  return queryPublishedPosts({
    indexName: "GSI2",
    keyConditionExpression: "GSI2PK = :pk",
    expressionAttributeValues: {
      ":pk": `REGION#${region}`,
      ":status": "published",
      ":generationStatus": "published"
    },
    expressionAttributeNames: {
      "#status": "status",
      "#generationStatus": "generationStatus"
    },
    filterExpression: "(#status = :status OR #generationStatus = :generationStatus)",
    limit: positiveInt(limit, DEFAULT_REGION_FETCH_LIMIT),
    includeHidden
  });
}

async function fetchPortfolioFromDynamo(params: {
  region: string;
  portfolio: string;
  limit: number;
  includeHidden?: boolean;
}): Promise<BriefPost[]> {
  return queryPublishedPosts({
    indexName: "GSI1",
    keyConditionExpression: "GSI1PK = :pk",
    expressionAttributeValues: {
      ":pk": `PORTFOLIO#${params.portfolio}`,
      ":status": "published",
      ":generationStatus": "published",
      ":region": params.region
    },
    expressionAttributeNames: {
      "#status": "status",
      "#generationStatus": "generationStatus",
      "#region": "region"
    },
    filterExpression: "(#status = :status OR #generationStatus = :generationStatus) AND #region = :region",
    limit: positiveInt(params.limit, DEFAULT_PORTFOLIO_FETCH_LIMIT),
    includeHidden: params.includeHidden
  });
}

export function latestPerPortfolio(posts: BriefPost[]): BriefPost[] {
  const latestByPortfolio = new Map<string, BriefPost>();
  for (const post of sortByPublished(posts).filter((item) => keepUserVisibleBrief(item))) {
    if (!latestByPortfolio.has(post.portfolio)) {
      latestByPortfolio.set(post.portfolio, post);
    }
  }
  return Array.from(latestByPortfolio.values());
}

export async function getRegionPosts(region: string, limit = DEFAULT_REGION_FETCH_LIMIT, includeHidden = false): Promise<BriefPost[]> {
  const validRegions = new Set<string>(REGION_LIST.map((r) => r.slug));
  if (!region || !validRegions.has(region)) return [];

  try {
    const live = await fetchRegionFromDynamo(region, limit, includeHidden);
    return sortByPublished(live);
  } catch (err) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "posts_region_read_failed",
        region,
        reasonCode: "dynamo_read_failed",
        error: (err as Error).message
      })
    );
    return [];
  }
}

export async function filterPosts(params: {
  region: string;
  portfolio?: string;
  runWindow?: string;
  limit?: number;
  includeHidden?: boolean;
}): Promise<BriefPost[]> {
  const targetLimit = positiveInt(params.limit ?? 20, 20);
  let posts: BriefPost[] = [];

  if (params.portfolio) {
    try {
      posts = await fetchPortfolioFromDynamo({
        region: params.region,
        portfolio: params.portfolio,
        limit: Math.max(targetLimit, DEFAULT_PORTFOLIO_FETCH_LIMIT),
        includeHidden: params.includeHidden
      });
    } catch (err) {
      console.warn("Falling back to region-scan portfolio query", params.portfolio, (err as Error).message);
      posts = await getRegionPosts(params.region, DEFAULT_REGION_FETCH_LIMIT, params.includeHidden);
    }
  } else {
    posts = await getRegionPosts(params.region, Math.max(targetLimit, DEFAULT_REGION_FETCH_LIMIT), params.includeHidden);
  }

  const filtered = posts.filter(
    (item) =>
      (!params.portfolio || item.portfolio === params.portfolio) &&
      (!params.runWindow || item.runWindow === params.runWindow)
  );
  return filtered.slice(0, targetLimit);
}

export async function getPost(postId: string): Promise<BriefPost | null> {
  const [client, tableName] = await Promise.all([getDynamoDocumentClient(), getDynamoTableName()]);

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
    if (found) {
      const normalized = normalizeBrief(found);
      if (!keepUserVisibleBrief(normalized)) return null;
      return normalized;
    }
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

  const validRegions = REGION_LIST.map((r) => r.slug);
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
        const normalized = normalizeBrief(found);
        if (!keepUserVisibleBrief(normalized)) {
          return null;
        }
        console.warn(
          JSON.stringify({
            level: "warn",
            event: "getPost_found_via_gsi2_fallback",
            postId,
            region
          })
        );
        return normalized;
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

  console.warn(
    JSON.stringify({
      level: "warn",
      event: "getPost_not_found",
      postId
    })
  );
  return null;
}
