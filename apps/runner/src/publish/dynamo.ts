import { PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { BriefPost, BriefRunIdentity, BriefRunMetrics, BriefRunStatus, buildBriefRunKey } from "@proof/shared";
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
  const briefDay = brief.briefDay ?? "";

  return {
    // Primary key
    PK: `POST#${brief.postId}`,
    SK: `DAY#${briefDay || brief.publishedAt}`,

    // GSI keys for querying
    GSI1PK: `PORTFOLIO#${brief.portfolio}`,
    GSI1SK: `DATE#${brief.publishedAt}`,
    GSI2PK: `REGION#${brief.region}`,
    GSI2SK: `DATE#${brief.publishedAt}`,
    GSI3PK: `STATUS#${brief.status}`,
    GSI3SK: `DATE#${brief.publishedAt}`,

    // Brief data
    ...brief,
    version: brief.version ?? "v2",

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

function briefRunKeys(identity: BriefRunIdentity) {
  const runKey = buildBriefRunKey(identity);
  return {
    runKey,
    pk: `BRIEFRUN#${runKey}`,
    sk: `BRIEFRUN#${runKey}`,
    gsi2pk: `RUNSTATUS#REGION#${identity.region}`,
    gsi2sk: `DATE#${identity.briefDay}#PORTFOLIO#${identity.portfolio}`
  };
}

/**
 * Logs the start of a brief run for idempotent tracking.
 */
export async function logBriefRunStart(
  identity: BriefRunIdentity,
  runId: string,
  startedAt: string,
  dryRun = false
) {
  const keys = briefRunKeys(identity);
  const update = new UpdateCommand({
    TableName: tableName,
    Key: { PK: keys.pk, SK: keys.sk },
    UpdateExpression:
      "SET #type = :type, #schema = :schema, #runId = :runId, #status = :status, " +
      "#runWindow = :runWindow, #region = :region, #portfolio = :portfolio, #briefDay = :briefDay, " +
      "#startedAt = if_not_exists(#startedAt, :startedAt), #updatedAt = :updatedAt, " +
      "#gsi2pk = :gsi2pk, #gsi2sk = :gsi2sk, #dryRun = :dryRun ADD #attempts :one",
    ExpressionAttributeNames: {
      "#type": "itemType",
      "#schema": "schemaVersion",
      "#runId": "runId",
      "#status": "status",
      "#runWindow": "runWindow",
      "#region": "region",
      "#portfolio": "portfolio",
      "#briefDay": "briefDay",
      "#startedAt": "startedAt",
      "#updatedAt": "updatedAt",
      "#gsi2pk": "GSI2PK",
      "#gsi2sk": "GSI2SK",
      "#dryRun": "dryRun",
      "#attempts": "attempts"
    },
    ExpressionAttributeValues: {
      ":type": "brief_run_status",
      ":schema": 1,
      ":runId": runId,
      ":status": "started",
      ":runWindow": identity.runWindow,
      ":region": identity.region,
      ":portfolio": identity.portfolio,
      ":briefDay": identity.briefDay,
      ":startedAt": startedAt,
      ":updatedAt": startedAt,
      ":gsi2pk": keys.gsi2pk,
      ":gsi2sk": keys.gsi2sk,
      ":dryRun": dryRun,
      ":one": 1
    }
  });
  await client.send(update);
}

/**
 * Logs the completion state of a brief run.
 */
export async function logBriefRunResult(params: {
  identity: BriefRunIdentity;
  runId: string;
  status: BriefRunStatus;
  finishedAt: string;
  metrics?: BriefRunMetrics;
  error?: string;
  dryRun?: boolean;
}) {
  const keys = briefRunKeys(params.identity);
  const updates: string[] = [
    "#status = :status",
    "#runId = :runId",
    "#finishedAt = :finishedAt",
    "#updatedAt = :updatedAt",
    "#runWindow = :runWindow",
    "#region = :region",
    "#portfolio = :portfolio",
    "#briefDay = :briefDay",
    "#gsi2pk = :gsi2pk",
    "#gsi2sk = :gsi2sk",
    "#dryRun = :dryRun"
  ];
  const names: Record<string, string> = {
    "#status": "status",
    "#runId": "runId",
    "#finishedAt": "finishedAt",
    "#updatedAt": "updatedAt",
    "#runWindow": "runWindow",
    "#region": "region",
    "#portfolio": "portfolio",
    "#briefDay": "briefDay",
    "#gsi2pk": "GSI2PK",
    "#gsi2sk": "GSI2SK",
    "#dryRun": "dryRun",
    "#metrics": "metrics",
    "#error": "error"
  };
  const values: Record<string, unknown> = {
    ":status": params.status,
    ":runId": params.runId,
    ":finishedAt": params.finishedAt,
    ":updatedAt": params.finishedAt,
    ":runWindow": params.identity.runWindow,
    ":region": params.identity.region,
    ":portfolio": params.identity.portfolio,
    ":briefDay": params.identity.briefDay,
    ":gsi2pk": keys.gsi2pk,
    ":gsi2sk": keys.gsi2sk,
    ":dryRun": params.dryRun ?? false
  };
  if (params.metrics) {
    updates.push("#metrics = :metrics");
    values[":metrics"] = params.metrics;
  }
  if (params.error) {
    updates.push("#error = :error");
    values[":error"] = params.error;
  }
  const update = new UpdateCommand({
    TableName: tableName,
    Key: { PK: keys.pk, SK: keys.sk },
    UpdateExpression: `SET ${updates.join(", ")}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values
  });
  await client.send(update);
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
