#!/usr/bin/env node
/**
 * Investigation script for Jan 21 brief generation failure
 * 
 * This script checks:
 * 1. DynamoDB run logs for Jan 21
 * 2. DynamoDB briefs published on Jan 21
 * 3. EventBridge/Scheduler execution history
 * 4. CloudWatch logs (if accessible)
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { EventBridgeClient, ListRulesCommand, ListTargetsByRuleCommand } from "@aws-sdk/client-eventbridge";
import { SchedulerClient, ListSchedulesCommand, GetScheduleCommand, ListScheduleExecutionsCommand } from "@aws-sdk/client-scheduler";
import { CloudWatchLogsClient, FilterLogEventsCommand } from "@aws-sdk/client-cloudwatch-logs";
import { LambdaClient, ListFunctionsCommand, GetFunctionCommand, InvokeCommand } from "@aws-sdk/client-lambda";

const tableName = process.env.DDB_TABLE_NAME ?? "CMHub";
const region = process.env.AWS_REGION ?? "us-east-1";

const ddbClient = new DynamoDBClient({ region });
const docClient = DynamoDBDocumentClient.from(ddbClient);
const eventBridgeClient = new EventBridgeClient({ region });
const schedulerClient = new SchedulerClient({ region });
const logsClient = new CloudWatchLogsClient({ region });
const lambdaClient = new LambdaClient({ region });

// Jan 21, 2025 in ISO format
const JAN_21_START = "2025-01-21T00:00:00.000Z";
const JAN_21_END = "2025-01-21T23:59:59.999Z";

async function checkRunLogs() {
  console.log("\n=== Checking Run Logs for Jan 21 ===");
  
  try {
    // Scan for run logs - they use PK: RUN#${runId}
    const result = await docClient.send(
      new ScanCommand({
        TableName: tableName,
        FilterExpression: "begins_with(PK, :prefix) AND finishedAt BETWEEN :start AND :end",
        ExpressionAttributeValues: {
          ":prefix": "RUN#",
          ":start": JAN_21_START,
          ":end": JAN_21_END
        }
      })
    );

    console.log(`Found ${result.Items?.length ?? 0} run logs on Jan 21`);
    
    if (result.Items && result.Items.length > 0) {
      console.log("\nRun Logs:");
      result.Items.forEach((item) => {
        console.log(`  - Run ID: ${item.runId}`);
        console.log(`    Agent: ${item.agentId}, Region: ${item.region}`);
        console.log(`    Status: ${item.status}`);
        if (item.error) console.log(`    Error: ${item.error}`);
        console.log(`    Finished: ${item.finishedAt}`);
        console.log("");
      });
    } else {
      console.log("⚠️  No run logs found for Jan 21 - this suggests no runs were executed!");
    }
  } catch (error) {
    console.error("Error checking run logs:", error);
  }
}

async function checkPublishedBriefs() {
  console.log("\n=== Checking Published Briefs for Jan 21 ===");
  
  try {
    // Query GSI2 (REGION index) for briefs on Jan 21
    const regions = ["au", "us-mx-la-lng"];
    let totalBriefs = 0;

    for (const regionSlug of regions) {
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
            ":start": `DATE#${JAN_21_START}`,
            ":end": `DATE#${JAN_21_END}`,
            ":status": "published"
          }
        })
      );

      const briefs = result.Items ?? [];
      totalBriefs += briefs.length;
      
      if (briefs.length > 0) {
        console.log(`\n${regionSlug.toUpperCase()} region: ${briefs.length} brief(s)`);
        briefs.forEach((brief) => {
          console.log(`  - ${brief.title || brief.postId}`);
          console.log(`    Portfolio: ${brief.portfolio}`);
          console.log(`    Published: ${brief.publishedAt}`);
          console.log(`    Run ID: ${brief.runId}`);
        });
      } else {
        console.log(`\n${regionSlug.toUpperCase()} region: No briefs published`);
      }
    }

    if (totalBriefs === 0) {
      console.log("\n⚠️  No briefs were published on Jan 21!");
    }
  } catch (error) {
    console.error("Error checking published briefs:", error);
  }
}

async function checkEventBridgeRules() {
  console.log("\n=== Checking EventBridge Rules ===");
  
  try {
    const result = await eventBridgeClient.send(new ListRulesCommand({}));
    
    const briefRules = (result.Rules ?? []).filter((rule) => 
      rule.Name?.includes("briefs") || rule.Name?.includes("apac") || rule.Name?.includes("international")
    );

    console.log(`Found ${briefRules.length} brief-related rules:`);
    
    for (const rule of briefRules) {
      console.log(`\n  Rule: ${rule.Name}`);
      console.log(`    State: ${rule.State}`);
      console.log(`    Schedule: ${rule.ScheduleExpression || "N/A"}`);
      
      if (rule.Name) {
        try {
          const targets = await eventBridgeClient.send(
            new ListTargetsByRuleCommand({ Rule: rule.Name })
          );
          console.log(`    Targets: ${targets.Targets?.length ?? 0}`);
          targets.Targets?.forEach((target) => {
            console.log(`      - ${target.Arn}`);
            if (target.HttpParameters?.HeaderParameters) {
              console.log(`        Has auth header: ${!!target.HttpParameters.HeaderParameters.Authorization}`);
            }
          });
        } catch (err) {
          console.log(`    Could not fetch targets: ${err}`);
        }
      }
    }
  } catch (error) {
    console.error("Error checking EventBridge rules:", error);
  }
}

async function checkScheduler() {
  console.log("\n=== Checking EventBridge Scheduler ===");
  
  try {
    const result = await schedulerClient.send(new ListSchedulesCommand({}));
    
    const briefSchedules = (result.Schedules ?? []).filter((schedule) =>
      schedule.Name?.includes("briefs") || schedule.Name?.includes("apac") || schedule.Name?.includes("international")
    );

    console.log(`Found ${briefSchedules.length} brief-related schedules:`);
    
    for (const schedule of briefSchedules) {
      const scheduleName = schedule.Name!;
      console.log(`\n  Schedule: ${scheduleName}`);
      console.log(`    State: ${schedule.State}`);
      
      // Get full schedule details
      try {
        const details = await schedulerClient.send(new GetScheduleCommand({ Name: scheduleName }));
        console.log(`    Schedule Expression: ${details.ScheduleExpression || "N/A"}`);
        console.log(`    Timezone: ${details.ScheduleExpressionTimezone || "N/A"}`);
        console.log(`    Flexible Time Window: ${details.FlexibleTimeWindow?.Mode || "N/A"}`);
        console.log(`    Target: ${details.Target?.Arn || "N/A"}`);
        
        // Check execution history for Jan 21
        const startTime = new Date(JAN_21_START);
        const endTime = new Date(JAN_21_END);
        
        try {
          const executions = await schedulerClient.send(
            new ListScheduleExecutionsCommand({
              Name: scheduleName,
              MaxResults: 50
            })
          );
          
          const jan21Executions = (executions.ScheduleExecutions || []).filter((exec) => {
            const execTime = exec.ExecutionDate ? new Date(exec.ExecutionDate) : null;
            return execTime && execTime >= startTime && execTime <= endTime;
          });
          
          console.log(`    Executions on Jan 21: ${jan21Executions.length}`);
          
          if (jan21Executions.length === 0) {
            // Check recent executions to see when it last ran
            const recentExecutions = (executions.ScheduleExecutions || []).slice(0, 5);
            if (recentExecutions.length > 0) {
              console.log(`    Recent executions:`);
              recentExecutions.forEach((exec) => {
                const execTime = exec.ExecutionDate ? new Date(exec.ExecutionDate).toISOString() : "N/A";
                const status = exec.Status || "UNKNOWN";
                console.log(`      - ${execTime}: ${status}`);
              });
            }
          } else {
            jan21Executions.forEach((exec) => {
              const execTime = exec.ExecutionDate ? new Date(exec.ExecutionDate).toISOString() : "N/A";
              const status = exec.Status || "UNKNOWN";
              console.log(`      - ${execTime}: ${status}`);
            });
          }
        } catch (execError: any) {
          console.log(`    Could not fetch execution history: ${execError.message}`);
        }
      } catch (detailError: any) {
        console.log(`    Could not fetch schedule details: ${detailError.message}`);
        console.log(`    Schedule Expression: ${schedule.ScheduleExpression || "N/A"}`);
        console.log(`    Target: ${schedule.Target?.Arn || "N/A"}`);
      }
    }
  } catch (error) {
    console.error("Error checking Scheduler:", error);
  }
}

async function checkLambdaFunction() {
  console.log("\n=== Checking Lambda Proxy Function ===");
  
  const functionName = "briefs-cron-proxy";
  
  try {
    const func = await lambdaClient.send(
      new GetFunctionCommand({ FunctionName: functionName })
    );
    
    console.log(`Function: ${functionName}`);
    console.log(`  Runtime: ${func.Configuration?.Runtime}`);
    console.log(`  Last Modified: ${func.Configuration?.LastModified}`);
    console.log(`  State: ${func.Configuration?.State}`);
    console.log(`  State Reason: ${func.Configuration?.StateReason || "N/A"}`);
    
    // Check Lambda logs
    const logGroupName = `/aws/lambda/${functionName}`;
    const startTime = new Date(JAN_21_START).getTime();
    const endTime = new Date(JAN_21_END).getTime();

    try {
      const result = await logsClient.send(
        new FilterLogEventsCommand({
          logGroupName,
          startTime,
          endTime,
          limit: 100
        })
      );

      if (result.events && result.events.length > 0) {
        console.log(`\nFound ${result.events.length} log events in ${logGroupName}:`);
        
        // Group by request ID to see invocations
        const invocations = new Map<string, any[]>();
        result.events.forEach((event) => {
          const requestId = event.logStreamName?.split("/")[1] || "unknown";
          if (!invocations.has(requestId)) {
            invocations.set(requestId, []);
          }
          invocations.get(requestId)!.push(event);
        });
        
        console.log(`\n  Total invocations on Jan 21: ${invocations.size}`);
        
        invocations.forEach((events, requestId) => {
          const firstEvent = events[0];
          const timestamp = new Date(firstEvent.timestamp ?? 0).toISOString();
          console.log(`\n  Invocation ${requestId.substring(0, 8)}... at ${timestamp}:`);
          
          // Show errors and important messages
          events.forEach((event) => {
            const msg = event.message || "";
            if (msg.includes("ERROR") || msg.includes("Exception") || msg.includes("Error") || 
                msg.includes("statusCode") || msg.includes("response")) {
              console.log(`    ${msg.substring(0, 300)}`);
            }
          });
        });
      } else {
        console.log(`\n⚠️  No log events found for ${logGroupName} on Jan 21`);
        console.log(`   This suggests the Lambda was NOT invoked on Jan 21!`);
      }
    } catch (error: any) {
      if (error.name === "ResourceNotFoundException") {
        console.log(`\n⚠️  Log group ${logGroupName} not found`);
      } else {
        console.log(`\n  Error checking logs: ${error.message}`);
      }
    }
  } catch (error: any) {
    if (error.name === "ResourceNotFoundException") {
      console.log(`⚠️  Lambda function ${functionName} not found`);
    } else {
      console.error(`Error checking Lambda: ${error.message}`);
    }
  }
}

async function checkCloudWatchLogs() {
  console.log("\n=== Checking Runner Service CloudWatch Logs ===");
  
  // Try to find the runner service log group
  const logGroupNames = [
    "/aws/apprunner/pocstudio-runner/service",
    "/aws/apprunner/pocstudio-runner",
    "/aws/apprunner/runner/service",
    "/aws/apprunner/runner"
  ];

  for (const logGroupName of logGroupNames) {
    try {
      const startTime = new Date(JAN_21_START).getTime();
      const endTime = new Date(JAN_21_END).getTime();

      const result = await logsClient.send(
        new FilterLogEventsCommand({
          logGroupName,
          startTime,
          endTime,
          filterPattern: "cron OR runId OR brief OR ERROR",
          limit: 50
        })
      );

      if (result.events && result.events.length > 0) {
        console.log(`\nFound ${result.events.length} log events in ${logGroupName}:`);
        result.events.slice(0, 10).forEach((event) => {
          const timestamp = new Date(event.timestamp ?? 0).toISOString();
          console.log(`  [${timestamp}] ${event.message?.substring(0, 200)}`);
        });
        if (result.events.length > 10) {
          console.log(`  ... and ${result.events.length - 10} more events`);
        }
        return; // Found logs, stop searching
      }
    } catch (error: any) {
      if (error.name !== "ResourceNotFoundException") {
        console.log(`  Error checking ${logGroupName}: ${error.message}`);
      }
    }
  }

  console.log("⚠️  Could not find CloudWatch logs. You may need to specify the correct log group name.");
}

async function main() {
  console.log("🔍 Investigating Jan 21 Brief Generation Failure");
  console.log(`Date range: ${JAN_21_START} to ${JAN_21_END}`);
  console.log(`Region: ${region}`);
  console.log(`DynamoDB Table: ${tableName}`);

  await checkRunLogs();
  await checkPublishedBriefs();
  await checkEventBridgeRules();
  await checkScheduler();
  await checkLambdaFunction();
  await checkCloudWatchLogs();

  console.log("\n=== Summary ===");
  console.log("Review the output above to identify why no briefs were generated on Jan 21.");
  console.log("Common issues:");
  console.log("  1. EventBridge/Scheduler rules not firing");
  console.log("  2. Runner service not receiving requests");
  console.log("  3. Runs failing during execution (check run logs)");
  console.log("  4. Window timing issues (runs outside scheduled window)");
}

main().catch(console.error);
