import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { BriefPost } from "@proof/shared";
import { v4 as uuidv4 } from "uuid";

const tableName = process.env.DDB_TABLE_NAME ?? "CMHub";
const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION ?? "us-east-1" }));

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
      collectedCount: ingestResult.articles?.length ?? 0
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
