import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { BriefPost, RegionSlug } from "@proof/shared";
import { documentClient, tableName } from "./client.js";

interface LatestBriefParams {
  portfolio: string;
  region: RegionSlug;
  beforeIso?: string;
}

/**
 * Fetches the latest published brief for a given portfolio/region, optionally constrained to before a timestamp.
 */
export async function getLatestPublishedBrief({
  portfolio,
  region,
  beforeIso
}: LatestBriefParams): Promise<BriefPost | null> {
  let lastKey: Record<string, unknown> | undefined;
  const keyCondition = beforeIso
    ? "GSI1PK = :pk AND GSI1SK < :before"
    : "GSI1PK = :pk";

  do {
    const result = await documentClient.send(
      new QueryCommand({
        TableName: tableName,
        IndexName: "GSI1",
        KeyConditionExpression: keyCondition,
        ExpressionAttributeValues: {
          ":pk": `PORTFOLIO#${portfolio}`,
          ...(beforeIso ? { ":before": `DATE#${beforeIso}` } : {}),
          ":region": region,
          ":status": "published"
        },
        ExpressionAttributeNames: {
          "#region": "region",
          "#status": "status"
        },
        FilterExpression: "#region = :region AND #status = :status",
        ScanIndexForward: false,
        Limit: 5,
        ExclusiveStartKey: lastKey
      })
    );

    const match = (result.Items ?? []).find((item) => item.region === region && item.status === "published");
    if (match) {
      return match as BriefPost;
    }

    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  return null;
}
