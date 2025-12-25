import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { BriefPost } from "@proof/shared";
import { IngestResult } from "../ingest/fetch.js";

const tableName = process.env.DDB_TABLE_NAME ?? "CMHub";
const region = process.env.AWS_REGION ?? "us-east-1";
const endpoint = process.env.DDB_ENDPOINT;

const client = DynamoDBDocumentClient.from(
  new DynamoDBClient(
    endpoint
      ? {
          region,
          endpoint,
          credentials: { accessKeyId: "local", secretAccessKey: "local" }
        }
      : { region }
  )
);

/**
 * Publishes a brief to DynamoDB with all article data preserved
 */
export async function publishBrief(
  brief: BriefPost,
  ingestResult: IngestResult,
  runId: string
) {
  const item = {
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
    runId
  };
  
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
