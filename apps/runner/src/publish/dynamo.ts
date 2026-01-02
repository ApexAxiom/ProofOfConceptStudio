import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { BriefPost } from "@proof/shared";
import { IngestResult } from "../ingest/fetch.js";
import { documentClient as client, tableName } from "../db/client.js";

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
    selectedArticles: brief.selectedArticles?.map((article) => ({
      title: article.title,
      url: article.url,
      briefContent: article.briefContent,
      categoryImportance: article.categoryImportance,
      keyMetrics: article.keyMetrics,
      imageUrl: article.imageUrl,
      imageAlt: article.imageAlt,
      sourceName: article.sourceName,
      publishedAt: article.publishedAt
    })),

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
  await client.send(new PutCommand({ TableName: tableName, Item: item }));
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
  const item = {
    PK: `RUN#${runId}`,
    SK: `AGENT#${agentId}#REGION#${region}`,
    runId,
    agentId,
    region,
    status,
    error,
    finishedAt: now
  };
  
  await client.send(new PutCommand({ TableName: tableName, Item: item }));
}
