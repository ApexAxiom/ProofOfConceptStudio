import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import {
  BriefPost,
  buildSourceId,
  normalizeBriefSources
} from "@proof/shared";
import { documentClient, tableName } from "./db/client.js";

const LIMIT = Number(process.env.VALIDATE_BRIEFS_LIMIT ?? 20);

async function fetchRecentBriefs(limit: number): Promise<BriefPost[]> {
  const result = await documentClient.send(
    new QueryCommand({
      TableName: tableName,
      IndexName: "GSI3",
      KeyConditionExpression: "GSI3PK = :pk",
      ExpressionAttributeValues: {
        ":pk": "STATUS#published"
      },
      ScanIndexForward: false,
      Limit: limit
    })
  );
  return (result.Items ?? []) as BriefPost[];
}

function validateBriefIntegrity(brief: BriefPost): string[] {
  const issues: string[] = [];
  const sources = normalizeBriefSources(brief.sources);
  const sourceIds = new Set(sources.map((s) => s.sourceId));
  const sourceUrls = new Set(sources.map((s) => s.url));

  if (!brief.claims || brief.claims.length === 0) {
    issues.push("missing claims");
  } else {
    for (const claim of brief.claims) {
      if (claim.status === "supported" && (!claim.evidence || claim.evidence.length === 0)) {
        issues.push(`claim ${claim.id} marked supported but has no evidence`);
      }
      for (const evidence of claim.evidence ?? []) {
        if (!sourceIds.has(evidence.sourceId)) {
          issues.push(`evidence sourceId missing from sources: ${evidence.sourceId}`);
        }
        if (!sourceUrls.has(evidence.url)) {
          issues.push(`evidence url missing from sources: ${evidence.url}`);
        }
      }
    }
  }

  for (const article of brief.selectedArticles ?? []) {
    const sourceId = article.sourceId ?? (article.url ? buildSourceId(article.url) : "");
    if (sourceId && sourceIds.size > 0 && !sourceIds.has(sourceId)) {
      issues.push(`selectedArticle not in sources: ${article.url}`);
    }
  }

  for (const indicator of brief.marketIndicators ?? []) {
    const sourceId = indicator.sourceId ?? (indicator.url ? buildSourceId(indicator.url) : "");
    if (sourceId && sourceIds.size > 0 && !sourceIds.has(sourceId)) {
      issues.push(`marketIndicator not in sources: ${indicator.url}`);
    }
  }

  return issues;
}

async function main() {
  const briefs = await fetchRecentBriefs(LIMIT);
  if (!briefs.length) {
    console.log("No briefs found to validate.");
    return;
  }

  let totalIssues = 0;
  for (const brief of briefs) {
    const issues = validateBriefIntegrity(brief);
    if (issues.length > 0) {
      totalIssues += issues.length;
      console.log(
        JSON.stringify({
          briefId: brief.postId,
          portfolio: brief.portfolio,
          region: brief.region,
          issues
        })
      );
    }
  }

  if (totalIssues > 0) {
    console.error(`Validation failed with ${totalIssues} issue(s).`);
    process.exit(1);
  }

  console.log(`Validated ${briefs.length} briefs with no issues.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
