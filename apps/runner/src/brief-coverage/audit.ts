import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { BriefPost, RegionSlug, getBriefDayKey } from "@proof/shared";
import { expandAgentsByRegion, loadAgents } from "../agents/config.js";
import { documentClient, tableName } from "../db/client.js";

export interface ExpectedAgentCoverage {
  agentId: string;
  portfolio: string;
  label: string;
  region: RegionSlug;
}

export interface CoverageAuditResult {
  dayKey: string;
  regions: RegionSlug[];
  expectedAgents: ExpectedAgentCoverage[];
  publishedBriefs: BriefPost[];
  missingAgents: ExpectedAgentCoverage[];
}

function compareDayKeys(left: string, right: string): number {
  return left.localeCompare(right);
}

/**
 * Returns the list of expected agent/region pairs for coverage checks.
 */
export function getExpectedAgentsForRegions(options: {
  regions: RegionSlug[];
  agentIds?: string[];
}): ExpectedAgentCoverage[] {
  const agents = loadAgents();
  const agentFilter = options.agentIds?.length ? new Set(options.agentIds) : null;
  const filteredAgents = agentFilter ? agents.filter((agent) => agentFilter.has(agent.id)) : agents;

  return expandAgentsByRegion({ agents: filteredAgents, regions: options.regions }).map(({ agent, region }) => ({
    agentId: agent.id,
    portfolio: agent.portfolio,
    label: agent.label,
    region
  }));
}

async function fetchPublishedBriefsForDay(region: RegionSlug, dayKey: string): Promise<BriefPost[]> {
  const briefs: BriefPost[] = [];
  let lastKey: Record<string, unknown> | undefined;
  let sawTargetDay = false;

  do {
    const result = await documentClient.send(
      new QueryCommand({
        TableName: tableName,
        IndexName: "GSI2",
        KeyConditionExpression: "GSI2PK = :pk",
        ExpressionAttributeValues: {
          ":pk": `REGION#${region}`,
          ":status": "published"
        },
        ExpressionAttributeNames: {
          "#status": "status"
        },
        FilterExpression: "#status = :status",
        ScanIndexForward: false,
        Limit: 100,
        ExclusiveStartKey: lastKey
      })
    );

    const items = (result.Items ?? []) as BriefPost[];
    for (const item of items) {
      if (!item.publishedAt) continue;
      const itemDayKey = item.briefDay ?? getBriefDayKey(region, new Date(item.publishedAt));
      if (itemDayKey === dayKey) {
        briefs.push(item);
        sawTargetDay = true;
        continue;
      }
      if (compareDayKeys(itemDayKey, dayKey) < 0) {
        return briefs;
      }
      if (compareDayKeys(itemDayKey, dayKey) > 0 && sawTargetDay) {
        return briefs;
      }
    }

    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  return briefs;
}

/**
 * Audits coverage for the given regions and brief day key.
 */
export async function auditCoverage(options: {
  regions: RegionSlug[];
  dayKey: string;
  agentIds?: string[];
}): Promise<CoverageAuditResult> {
  const expectedAgents = getExpectedAgentsForRegions({ regions: options.regions, agentIds: options.agentIds });
  const publishedByRegion = await Promise.all(options.regions.map((region) => fetchPublishedBriefsForDay(region, options.dayKey)));
  const publishedBriefs = publishedByRegion.flat();

  const publishedPortfolios = new Set(
    publishedBriefs.map((brief) => `${brief.region}:${brief.portfolio}`)
  );

  const missingAgents = expectedAgents.filter(
    (agent) => !publishedPortfolios.has(`${agent.region}:${agent.portfolio}`)
  );

  return {
    dayKey: options.dayKey,
    regions: options.regions,
    expectedAgents,
    publishedBriefs,
    missingAgents
  };
}
