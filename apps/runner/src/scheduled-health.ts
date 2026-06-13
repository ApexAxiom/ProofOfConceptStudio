import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import {
  BriefRunStatusRecord,
  REGIONS,
  RegionSlug,
  RunWindow,
  getBriefDayKey,
  runWindowForRegion
} from "@proof/shared";
import { documentClient, tableName } from "./db/client.js";
import { emitRunnerMetrics } from "./observability/metrics.js";
import { isScheduledRunDay } from "./schedule-guard.js";

type RunStatusRecordLite = Pick<BriefRunStatusRecord, "status" | "finishedAt" | "runWindow"> & {
  dryRun?: boolean;
};

export interface ScheduledRunHealth {
  region: RegionSlug;
  runWindow: RunWindow;
  briefDay: string;
  due: boolean;
  completed: boolean;
  published: boolean;
  completedCount: number;
  publishedCount: number;
  recordCount: number;
  ok: boolean;
}

const COMPLETE_STATUSES = new Set(["succeeded", "failed", "no-updates"]);

async function fetchRunStatusForDay(region: RegionSlug, briefDay: string): Promise<BriefRunStatusRecord[]> {
  const response = await documentClient.send(
    new QueryCommand({
      TableName: tableName,
      IndexName: "GSI2",
      KeyConditionExpression: "GSI2PK = :pk AND begins_with(GSI2SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `RUNSTATUS#REGION#${region}`,
        ":sk": `DATE#${briefDay}`,
        ":type": "brief_run_status"
      },
      ExpressionAttributeNames: {
        "#type": "itemType"
      },
      FilterExpression: "#type = :type",
      ScanIndexForward: false,
      Limit: 300
    })
  );

  return (response.Items ?? []) as BriefRunStatusRecord[];
}

export function evaluateScheduledRunHealth(params: {
  region: RegionSlug;
  runWindow?: RunWindow;
  now?: Date;
  records: RunStatusRecordLite[];
}): ScheduledRunHealth {
  const now = params.now ?? new Date();
  const runWindow = params.runWindow ?? runWindowForRegion(params.region);
  const briefDay = getBriefDayKey(params.region, now);
  const due = isScheduledRunDay(runWindow, now);
  const relevantRecords = params.records.filter((record) => {
    if (record.dryRun === true) return false;
    if (record.runWindow && record.runWindow !== runWindow) return false;
    return true;
  });
  const completedCount = relevantRecords.filter((record) => record.finishedAt && COMPLETE_STATUSES.has(record.status)).length;
  const publishedCount = relevantRecords.filter((record) => record.finishedAt && record.status === "succeeded").length;

  return {
    region: params.region,
    runWindow,
    briefDay,
    due,
    completed: due ? completedCount > 0 : true,
    published: due ? publishedCount > 0 : true,
    completedCount,
    publishedCount,
    recordCount: relevantRecords.length,
    ok: due ? completedCount > 0 && publishedCount > 0 : true
  };
}

export async function emitScheduledRunHealth(params: {
  region: RegionSlug;
  runWindow?: RunWindow;
  now?: Date;
}): Promise<ScheduledRunHealth> {
  const now = params.now ?? new Date();
  const runWindow = params.runWindow ?? runWindowForRegion(params.region);
  const briefDay = getBriefDayKey(params.region, now);
  const records = await fetchRunStatusForDay(params.region, briefDay);
  const health = evaluateScheduledRunHealth({
    region: params.region,
    runWindow,
    now,
    records
  });

  emitRunnerMetrics({
    dimensions: {
      Region: params.region
    },
    metrics: [
      { name: "ExpectedRunDue", value: health.due ? 1 : 0, unit: "Count" },
      { name: "ExpectedRunCompleted", value: health.completed ? 1 : 0, unit: "Count" },
      { name: "ExpectedBriefPublished", value: health.published ? 1 : 0, unit: "Count" },
      { name: "ExpectedRunStatusRecords", value: health.recordCount, unit: "Count" },
      { name: "ExpectedRunPublishedRecords", value: health.publishedCount, unit: "Count" }
    ],
    properties: {
      event: "scheduled_run_health",
      runWindow,
      briefDay,
      due: health.due,
      timeZone: REGIONS[params.region].timeZone
    }
  });

  return health;
}
