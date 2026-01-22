import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { BriefPost } from "@proof/shared";
import { IngestResult } from "../ingest/fetch.js";
import { documentClient as client, tableName } from "../db/client.js";

/**
 * Recursively remove undefined values from objects/arrays so DynamoDB Put never receives them.
 */
function stripUndefined<T>(value: T): T {
  if (value === undefined) return value;
  if (value === null) return value;
  if (Array.isArray(value)) {
    return value.map((v) => (v === undefined ? null : stripUndefined(v))) as T;
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      const stripped = stripUndefined(v);
      if (stripped !== undefined) out[k] = stripped;
    }
    return out as T;
  }
  return value;
}

/**
 * Builds the DynamoDB item for a brief while preserving article metadata.
 */
export function buildDynamoItem(
  brief: BriefPost,
  ingestResult: IngestResult,
  runId: string
) {
  const ttlSeconds = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 180; // ~6 months retention

  return {
    // Primary key
    PK: `POST#${brief.postId}`,
    SK: `DATE#${brief.publishedAt}`,

    // GSI keys for querying
    GSI1PK: `PORTFOLIO#${brief.portfolio}`,
    GSI1SK: `DATE#${brief.publishedAt}`,
    GSI2PK: `REGION#${brief.region}`,
    GSI2SK: `DATE#${brief.publishedAt}`,
    GSI3PK: `STATUS#${brief.status}`,
    GSI3SK: `DATE#${brief.publishedAt}`,

    // Brief data
    ...brief,

    // Ensure selectedArticles is properly stored
    selectedArticles: brief.selectedArticles?.map((article) => {
      const mapped: Record<string, any> = {
        title: article.title,
        url: article.url
      };
      if (article.briefContent) mapped.briefContent = article.briefContent;
      if (article.categoryImportance) mapped.categoryImportance = article.categoryImportance;
      if (article.keyMetrics) mapped.keyMetrics = article.keyMetrics;
      if (article.imageUrl) mapped.imageUrl = article.imageUrl;
      if (article.imageAlt) mapped.imageAlt = article.imageAlt;
      if (article.sourceName) mapped.sourceName = article.sourceName;
      if (article.publishedAt) mapped.publishedAt = article.publishedAt;
      if (article.sourceIndex !== undefined) mapped.sourceIndex = article.sourceIndex;
      if (article.sourceId) mapped.sourceId = article.sourceId;
      return mapped;
    }),

    // Ingestion metadata
    scannedSources: ingestResult.scannedSources,
    metrics: {
      collectedCount: ingestResult.metrics?.collectedCount ?? 0,
      extractedCount: ingestResult.metrics?.extractedCount ?? 0,
      dedupedCount: ingestResult.metrics?.dedupedCount ?? 0
    },

    // Run tracking
    runId,

    // Data retention
    ttl: ttlSeconds
  };
}

/**
 * Publishes a brief to DynamoDB with all article data preserved
 */
export async function publishBrief(
  brief: BriefPost,
  ingestResult: IngestResult,
  runId: string
) {
  const item = buildDynamoItem(brief, ingestResult, runId);
  const clean = stripUndefined(item) as Record<string, unknown>;
  await client.send(new PutCommand({ TableName: tableName, Item: clean }));
}

/**
 * Logs the result of a run for monitoring
 */
export async function logRunResult(
  runId: string,
  agentId: string,
  region: string,
  status: string,
  error?: string
) {
  const now = new Date().toISOString();
  const item: Record<string, any> = {
    PK: `RUN#${runId}`,
    SK: `AGENT#${agentId}#REGION#${region}`,
    runId,
    agentId,
    region,
    status,
    finishedAt: now
  };
  
  if (error) {
    item.error = error;
  }

  const clean = stripUndefined(item) as Record<string, unknown>;
  await client.send(new PutCommand({ TableName: tableName, Item: clean }));
}
