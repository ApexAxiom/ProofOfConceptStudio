#!/usr/bin/env node
/**
 * Check that all categories are generating briefs
 * 
 * This script verifies:
 * 1. All configured agents are running
 * 2. All categories have recent briefs
 * 3. Both regions are covered
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { loadAgents, expandAgentsByRegion } from "../apps/runner/src/agents/config.js";

const tableName = process.env.DDB_TABLE_NAME ?? "CMHub";
const region = process.env.AWS_REGION ?? "us-east-1";

const ddbClient = new DynamoDBClient({ region });
const docClient = DynamoDBDocumentClient.from(ddbClient);

// Check briefs from the last 3 days
const THREE_DAYS_AGO = new Date();
THREE_DAYS_AGO.setDate(THREE_DAYS_AGO.getDate() - 3);
const START_DATE = THREE_DAYS_AGO.toISOString();
const END_DATE = new Date().toISOString();

async function checkCategoryCoverage() {
  console.log("🔍 Checking Category Coverage");
  console.log(`Date range: ${START_DATE} to ${END_DATE}\n`);

  const agents = loadAgents();
  const normalAgents = agents.filter((a) => a.mode !== "market-dashboard");
  const dashboardAgents = agents.filter((a) => a.mode === "market-dashboard");
  const allAgents = expandAgentsByRegion({ agents: normalAgents });
  const allRegions = ["au", "us-mx-la-lng"] as const;

  console.log(`Total Categories: ${normalAgents.length}`);
  console.log(`Total Regions: ${allRegions.length}`);
  console.log(`Expected Briefs per Run: ${normalAgents.length * allRegions.length} category briefs + ${dashboardAgents.length * allRegions.length} dashboard briefs\n`);

  const coverage: Record<string, Record<string, number>> = {};

  // Initialize coverage map
  for (const agent of normalAgents) {
    coverage[agent.portfolio] = {};
    for (const regionSlug of allRegions) {
      coverage[agent.portfolio][regionSlug] = 0;
    }
  }

  // Check each region
  for (const regionSlug of allRegions) {
    console.log(`\n=== Checking ${regionSlug.toUpperCase()} Region ===`);
    
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
      console.log(`Found ${briefs.length} published briefs in last 3 days`);

      // Count briefs by portfolio
      const portfolioCounts: Record<string, number> = {};
      briefs.forEach((brief: any) => {
        const portfolio = brief.portfolio;
        if (portfolio) {
          portfolioCounts[portfolio] = (portfolioCounts[portfolio] || 0) + 1;
          if (coverage[portfolio] && coverage[portfolio][regionSlug] !== undefined) {
            coverage[portfolio][regionSlug] = (coverage[portfolio][regionSlug] || 0) + 1;
          }
        }
      });

      // Show counts per category
      const sortedPortfolios = Object.entries(portfolioCounts).sort((a, b) => b[1] - a[1]);
      for (const [portfolio, count] of sortedPortfolios) {
        const agent = normalAgents.find((a) => a.portfolio === portfolio);
        const label = agent?.label || portfolio;
        console.log(`  ${label}: ${count} brief(s)`);
      }
    } catch (error: any) {
      console.error(`Error checking ${regionSlug}:`, error.message);
    }
  }

  // Summary
  console.log("\n=== Coverage Summary ===");
  console.log("\nCategories with missing briefs:\n");

  let missingCount = 0;
  for (const agent of normalAgents) {
    const portfolio = agent.portfolio;
    const label = agent.label;
    const auCount = coverage[portfolio]?.au || 0;
    const usCount = coverage[portfolio]?.["us-mx-la-lng"] || 0;

    if (auCount === 0 || usCount === 0) {
      missingCount++;
      console.log(`⚠️  ${label} (${portfolio}):`);
      console.log(`   AU: ${auCount === 0 ? "❌ MISSING" : `✓ ${auCount}`}`);
      console.log(`   US-MX-LA-LNG: ${usCount === 0 ? "❌ MISSING" : `✓ ${usCount}`}`);
    }
  }

  if (missingCount === 0) {
    console.log("✅ All categories have briefs in both regions!");
  } else {
    console.log(`\n⚠️  ${missingCount} category(ies) are missing briefs in one or both regions`);
  }

  // Check dashboard
  console.log("\n=== Market Dashboard ===");
  for (const regionSlug of allRegions) {
    try {
      const result = await docClient.send(
        new QueryCommand({
          TableName: tableName,
          IndexName: "GSI2",
          KeyConditionExpression: "GSI2PK = :region AND GSI2SK BETWEEN :start AND :end",
          ExpressionAttributeValues: {
            ":region": `REGION#${regionSlug}`,
            ":start": `DATE#${START_DATE}`,
            ":end": `DATE#${END_DATE}`
          },
          FilterExpression: "#status = :status AND portfolio = :portfolio",
          ExpressionAttributeNames: {
            "#status": "status"
          },
          ExpressionAttributeValues: {
            ":region": `REGION#${regionSlug}`,
            ":start": `DATE#${START_DATE}`,
            ":end": `DATE#${END_DATE}`,
            ":status": "published",
            ":portfolio": "market-dashboard"
          }
        })
      );

      const count = result.Items?.length || 0;
      console.log(`  ${regionSlug.toUpperCase()}: ${count === 0 ? "❌ MISSING" : `✓ ${count} brief(s)`}`);
    } catch (error: any) {
      console.log(`  ${regionSlug.toUpperCase()}: Error checking - ${error.message}`);
    }
  }
}

checkCategoryCoverage().catch(console.error);
