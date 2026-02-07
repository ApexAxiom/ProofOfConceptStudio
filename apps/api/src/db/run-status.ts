import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import client from "./dynamo.js";
import type { BriefRunStatusRecord, RegionSlug } from "@proof/shared";

const tableName = process.env.DDB_TABLE_NAME ?? "CMHub";
const DEFAULT_LIMIT = Number(process.env.RUN_STATUS_FETCH_LIMIT ?? 200);

function positiveInt(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.floor(value);
}

/**
 * Fetch brief run status records for a region (optionally constrained to a briefDay).
 */
export async function fetchRunStatus(params: {
  region: RegionSlug;
  briefDay?: string;
  limit?: number;
}): Promise<BriefRunStatusRecord[]> {
  const limit = positiveInt(params.limit ?? DEFAULT_LIMIT, DEFAULT_LIMIT);
  const skPrefix = params.briefDay ? `DATE#${params.briefDay}` : "DATE#";

  const response = await client.send(
    new QueryCommand({
      TableName: tableName,
      IndexName: "GSI2",
      KeyConditionExpression: "GSI2PK = :pk AND begins_with(GSI2SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `RUNSTATUS#REGION#${params.region}`,
        ":sk": skPrefix,
        ":type": "brief_run_status"
      },
      ExpressionAttributeNames: {
        "#type": "itemType"
      },
      FilterExpression: "#type = :type",
      ScanIndexForward: false,
      Limit: limit
    })
  );

  return (response.Items ?? []) as BriefRunStatusRecord[];
}
