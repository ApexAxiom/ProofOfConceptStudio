import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { BriefPost } from "@proof/shared";

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

export async function publishBrief(brief: BriefPost, ingestResult: any, runId: string) {
  const item = {
    PK: `POST#${brief.postId}`,
    SK: `DATE#${brief.publishedAt}`,
    GSI1PK: `PORTFOLIO#${brief.portfolio}`,
    GSI1SK: `DATE#${brief.publishedAt}`,
    GSI2PK: `REGION#${brief.region}`,
    GSI2SK: `DATE#${brief.publishedAt}`,
    GSI3PK: `STATUS#${brief.status}`,
    GSI3SK: `DATE#${brief.publishedAt}`,
    ...brief,
    scannedSources: ingestResult.scannedSources,
    metrics: {
      collectedCount: ingestResult.metrics?.collectedCount ?? ingestResult.articles?.length ?? 0,
      extractedCount: ingestResult.metrics?.extractedCount,
      dedupedCount: ingestResult.metrics?.dedupedCount
    }
  };
  await client.send(new PutCommand({ TableName: tableName, Item: item }));
}

export async function logRunResult(runId: string, agentId: string, region: string, status: string, error?: string) {
  const now = new Date().toISOString();
  const item = {
    PK: `RUN#${runId}`,
    SK: `DATE#${now}`,
    runId,
    agentId,
    region,
    status,
    error,
    finishedAt: now
  };
  await client.send(new PutCommand({ TableName: tableName, Item: item }));
}
