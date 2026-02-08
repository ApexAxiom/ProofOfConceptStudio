#!/usr/bin/env node
/**
 * Comprehensive diagnostic script to identify why categories are missing briefs
 * 
 * This script checks:
 * 1. Which categories have no recent briefs
 * 2. Run logs to see if runs are failing
 * 3. Failed/draft briefs that might indicate validation issues
 * 4. Feed ingestion issues
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { loadAgents } from "../apps/runner/src/agents/config.js";

const tableName = process.env.DDB_TABLE_NAME ?? "CMHub";
const region = process.env.AWS_REGION ?? "us-east-1";

const ddbClient = new DynamoDBClient({ region });
const docClient = DynamoDBDocumentClient.from(ddbClient);

// Check briefs from the last 7 days
const SEVEN_DAYS_AGO = new Date();
SEVEN_DAYS_AGO.setDate(SEVEN_DAYS_AGO.getDate() - 7);
const START_DATE = SEVEN_DAYS_AGO.toISOString();
const END_DATE = new Date().toISOString();

async function checkPublishedBriefs() {
  console.log("\n=== Published Briefs (Last 7 Days) ===");
  
  const agents = loadAgents();
  const normalAgents = agents.filter((a) => a.mode !== "market-dashboard");
  const allRegions = ["au", "us-mx-la-lng"] as const;
  
  const coverage: Record<string, Record<string, { count: number; latest?: string }>> = {};
  
  // Initialize coverage map
  for (const agent of normalAgents) {
    coverage[agent.portfolio] = {};
    for (const regionSlug of allRegions) {
      coverage[agent.portfolio][regionSlug] = { count: 0 };
    }
  }

  for (const regionSlug of allRegions) {
    try {
      const result = await docClient.send(
        new QueryCommand({
          TableName: tableName,
          IndexName: "GSI2",
          KeyConditionExpression: "GSI2PK = :region AND GSI2SK BETWEEN :start AND :end",
          FilterExpression: "#status = :status",
          ExpressionAttributeNames: {
            "#status": "status"
          },
          ExpressionAttributeValues: {
            ":region": `REGION#${regionSlug}`,
            ":start": `DATE#${START_DATE}`,
            ":end": `DATE#${END_DATE}`,
            ":status": "published"
          }
        })
      );

      const briefs = result.Items ?? [];
      
      briefs.forEach((brief: any) => {
        const portfolio = brief.portfolio;
        if (portfolio && coverage[portfolio] && coverage[portfolio][regionSlug]) {
          coverage[portfolio][regionSlug].count++;
          const publishedAt = brief.publishedAt;
          if (publishedAt && (!coverage[portfolio][regionSlug].latest || publishedAt > coverage[portfolio][regionSlug].latest!)) {
            coverage[portfolio][regionSlug].latest = publishedAt;
          }
        }
      });
    } catch (error: any) {
      console.error(`Error checking ${regionSlug}:`, error.message);
    }
  }

  // Show missing categories
  console.log("\nCategories with missing or stale briefs:\n");
  let missingCount = 0;
  
  for (const agent of normalAgents) {
    const portfolio = agent.portfolio;
    const label = agent.label;
    const auData = coverage[portfolio]?.au || { count: 0 };
    const usData = coverage[portfolio]?.["us-mx-la-lng"] || { count: 0 };
    
    const auDaysAgo = auData.latest ? Math.floor((new Date().getTime() - new Date(auData.latest).getTime()) / (1000 * 60 * 60 * 24)) : null;
    const usDaysAgo = usData.latest ? Math.floor((new Date().getTime() - new Date(usData.latest).getTime()) / (1000 * 60 * 60 * 24)) : null;
    
    if (auData.count === 0 || usData.count === 0 || (auDaysAgo && auDaysAgo > 3) || (usDaysAgo && usDaysAgo > 3)) {
      missingCount++;
      console.log(`⚠️  ${label} (${portfolio}):`);
      if (auData.count === 0) {
        console.log(`   AU: ❌ NO BRIEFS (never published)`);
      } else if (auDaysAgo && auDaysAgo > 3) {
        console.log(`   AU: ⚠️  ${auData.count} brief(s), latest ${auDaysAgo} days ago`);
      } else {
        console.log(`   AU: ✓ ${auData.count} brief(s), latest ${auDaysAgo || 0} days ago`);
      }
      
      if (usData.count === 0) {
        console.log(`   US-MX-LA-LNG: ❌ NO BRIEFS (never published)`);
      } else if (usDaysAgo && usDaysAgo > 3) {
        console.log(`   US-MX-LA-LNG: ⚠️  ${usData.count} brief(s), latest ${usDaysAgo} days ago`);
      } else {
        console.log(`   US-MX-LA-LNG: ✓ ${usData.count} brief(s), latest ${usDaysAgo || 0} days ago`);
      }
    }
  }
  
  if (missingCount === 0) {
    console.log("✅ All categories have recent briefs!");
  }
  
  return coverage;
}

async function checkFailedRuns() {
  console.log("\n=== Failed Run Logs (Last 7 Days) ===");
  
  try {
    const result = await docClient.send(
      new ScanCommand({
        TableName: tableName,
        FilterExpression: "begins_with(PK, :prefix) AND finishedAt BETWEEN :start AND :end AND #status = :status",
        ExpressionAttributeNames: {
          "#status": "status"
        },
        ExpressionAttributeValues: {
          ":prefix": "RUN#",
          ":start": START_DATE,
          ":end": END_DATE,
          ":status": "failed"
        }
      })
    );

    const failedRuns = result.Items ?? [];
    console.log(`Found ${failedRuns.length} failed runs\n`);
    
    if (failedRuns.length > 0) {
      // Group by agent
      const byAgent: Record<string, any[]> = {};
      failedRuns.forEach((run: any) => {
        const key = `${run.agentId || "unknown"}/${run.region || "unknown"}`;
        if (!byAgent[key]) byAgent[key] = [];
        byAgent[key].push(run);
      });
      
      for (const [key, runs] of Object.entries(byAgent)) {
        console.log(`\n${key}: ${runs.length} failure(s)`);
        const latest = runs.sort((a, b) => (b.finishedAt || "").localeCompare(a.finishedAt || ""))[0];
        console.log(`  Latest: ${latest.finishedAt}`);
        console.log(`  Error: ${latest.error || "No error message"}`);
      }
    } else {
      console.log("✅ No failed runs found");
    }
  } catch (error: any) {
    console.error("Error checking failed runs:", error.message);
  }
}

async function checkDraftBriefs() {
  console.log("\n=== Draft/Failed Briefs (Last 7 Days) ===");
  
  try {
    const result = await docClient.send(
      new ScanCommand({
        TableName: tableName,
        FilterExpression: "begins_with(PK, :prefix) AND publishedAt BETWEEN :start AND :end AND (#status = :draft OR #status = :failed)",
        ExpressionAttributeNames: {
          "#status": "status"
        },
        ExpressionAttributeValues: {
          ":prefix": "POST#",
          ":start": START_DATE,
          ":end": END_DATE,
          ":draft": "draft",
          ":failed": "failed"
        }
      })
    );

    const draftBriefs = result.Items ?? [];
    console.log(`Found ${draftBriefs.length} draft/failed briefs\n`);
    
    if (draftBriefs.length > 0) {
      // Group by portfolio
      const byPortfolio: Record<string, any[]> = {};
      draftBriefs.forEach((brief: any) => {
        const portfolio = brief.portfolio || "unknown";
        if (!byPortfolio[portfolio]) byPortfolio[portfolio] = [];
        byPortfolio[portfolio].push(brief);
      });
      
      for (const [portfolio, briefs] of Object.entries(byPortfolio)) {
        console.log(`\n${portfolio}: ${briefs.length} draft/failed brief(s)`);
        const latest = briefs.sort((a, b) => (b.publishedAt || "").localeCompare(a.publishedAt || ""))[0];
        console.log(`  Latest: ${latest.publishedAt}`);
        if (latest.qualityReport?.issues) {
          console.log(`  Issues: ${latest.qualityReport.issues.slice(0, 3).join("; ")}`);
        }
        if (latest.bodyMarkdown && latest.bodyMarkdown.includes("Evidence validation failed")) {
          console.log(`  ⚠️  Validation failed - brief was blocked`);
        }
      }
    } else {
      console.log("✅ No draft/failed briefs found");
    }
  } catch (error: any) {
    console.error("Error checking draft briefs:", error.message);
  }
}

async function checkRecentRuns() {
  console.log("\n=== Recent Run Activity (Last 7 Days) ===");
  
  try {
    const result = await docClient.send(
      new ScanCommand({
        TableName: tableName,
        FilterExpression: "begins_with(PK, :prefix) AND finishedAt BETWEEN :start AND :end",
        ExpressionAttributeValues: {
          ":prefix": "RUN#",
          ":start": START_DATE,
          ":end": END_DATE
        }
      })
    );

    const allRuns = result.Items ?? [];
    console.log(`Total runs: ${allRuns.length}`);
    
    const byAgent: Record<string, { success: number; failed: number }> = {};
    allRuns.forEach((run: any) => {
      const key = `${run.agentId || "unknown"}/${run.region || "unknown"}`;
      if (!byAgent[key]) byAgent[key] = { success: 0, failed: 0 };
      // logRunResult (RUN#) uses "published" | "no-updates" | "dry-run" | "failed"
      if (run.status === "published" || run.status === "no-updates" || run.status === "dry-run" || run.status === "succeeded" || run.status === "success") {
        byAgent[key].success++;
      } else if (run.status === "failed") {
        byAgent[key].failed++;
      }
    });
    
    const agents = loadAgents();
    const normalAgents = agents.filter((a) => a.mode !== "market-dashboard");
    
    console.log("\nRun activity by category:\n");
    for (const agent of normalAgents) {
      const auKey = `${agent.id}/au`;
      const usKey = `${agent.id}/us-mx-la-lng`;
      const auRuns = byAgent[auKey] || { success: 0, failed: 0 };
      const usRuns = byAgent[usKey] || { success: 0, failed: 0 };
      
      if (auRuns.success === 0 && auRuns.failed === 0 && usRuns.success === 0 && usRuns.failed === 0) {
        console.log(`⚠️  ${agent.label}: NO RUNS in last 7 days`);
      } else {
        console.log(`${agent.label}:`);
        console.log(`  AU: ${auRuns.success} success, ${auRuns.failed} failed`);
        console.log(`  US: ${usRuns.success} success, ${usRuns.failed} failed`);
      }
    }
  } catch (error: any) {
    console.error("Error checking recent runs:", error.message);
  }
}

async function main() {
  console.log("🔍 Diagnosing Missing Briefs");
  console.log(`Date range: ${START_DATE} to ${END_DATE}`);
  console.log(`Region: ${region}`);
  console.log(`DynamoDB Table: ${tableName}`);

  await checkPublishedBriefs();
  await checkFailedRuns();
  await checkDraftBriefs();
  await checkRecentRuns();

  console.log("\n=== Recommendations ===");
  console.log("1. If categories show 'NO RUNS', check EventBridge Scheduler configuration");
  console.log("2. If runs are failing, check the error messages above");
  console.log("3. If briefs are in draft/failed status, check validation issues");
  console.log("4. If no articles are being ingested, check feed URLs and network connectivity");
  console.log("5. Run the scheduler manually to test: curl -X POST <runner-url>/cron -H 'Authorization: Bearer <secret>' -d '{\"regions\":[\"au\",\"us-mx-la-lng\"],\"scheduled\":false}'");
}

main().catch(console.error);
