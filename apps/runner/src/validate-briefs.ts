import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import {
  BriefPost,
  buildSourceId,
  normalizeBriefSources,
  toBriefViewModelV2,
  validateBriefV2Record
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

function validateBriefIntegrity(brief: BriefPost, hasPreviousBrief: boolean): string[] {
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

  const viewModel = toBriefViewModelV2(brief);
  if (!viewModel.heroImage.url) {
    issues.push("view model missing hero image URL");
  }

  const v2Validation = validateBriefV2Record(brief, { hasPreviousBrief });
  issues.push(...v2Validation.issues);

  return issues;
}

async function main() {
  const briefs = await fetchRecentBriefs(LIMIT);
  if (!briefs.length) {
    console.log("No briefs found to validate.");
    return;
  }

  let totalIssues = 0;
  const byPortfolioRegion = new Map<string, BriefPost[]>();
  const sorted = [...briefs].sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  for (const brief of sorted) {
    const key = `${brief.portfolio}::${brief.region}`;
    const list = byPortfolioRegion.get(key) ?? [];
    list.push(brief);
    byPortfolioRegion.set(key, list);
  }

  for (const brief of sorted) {
    const key = `${brief.portfolio}::${brief.region}`;
    const list = byPortfolioRegion.get(key) ?? [];
    const index = list.findIndex((item) => item.postId === brief.postId);
    const hasPreviousBrief = index >= 0 && index < list.length - 1;

    const issues = validateBriefIntegrity(brief, hasPreviousBrief);
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
