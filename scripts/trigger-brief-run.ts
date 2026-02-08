#!/usr/bin/env node
/**
 * Manual trigger and scheduler check for brief runs.
 *
 * Use when EventBridge did not fire or you need a catch-up run.
 *
 * Trigger a run (requires RUNNER_BASE_URL and CRON_SECRET):
 *   RUNNER_BASE_URL=https://runner... CRON_SECRET=xxx pnpm exec tsx scripts/trigger-brief-run.ts run
 *   RUNNER_BASE_URL=... CRON_SECRET=... pnpm exec tsx scripts/trigger-brief-run.ts run --wait
 *
 * Check scheduler and diagnostics (requires AWS credentials and DDB_TABLE_NAME for full diagnostics):
 *   pnpm exec tsx scripts/trigger-brief-run.ts check
 */

const RUNNER_BASE_URL = process.env.RUNNER_BASE_URL?.replace(/\/$/, "") ?? "";
const CRON_SECRET = process.env.CRON_SECRET ?? "";

async function triggerRun(waitForCompletion: boolean): Promise<void> {
  if (!RUNNER_BASE_URL || !CRON_SECRET) {
    console.error("Set RUNNER_BASE_URL and CRON_SECRET to trigger a run.");
    console.error("Example: RUNNER_BASE_URL=https://runner... CRON_SECRET=xxx pnpm exec tsx scripts/trigger-brief-run.ts run");
    process.exit(1);
  }

  const payload = {
    regions: ["au", "us-mx-la-lng"],
    runWindow: undefined as string | undefined,
    scheduled: false,
    force: true,
    waitForCompletion: waitForCompletion || undefined
  };

  console.log("Triggering brief run:", JSON.stringify({ ...payload, waitForCompletion }, null, 2));
  console.log("POST", `${RUNNER_BASE_URL}/cron`);

  const res = await fetch(`${RUNNER_BASE_URL}/cron`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CRON_SECRET}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }

  if (!res.ok) {
    console.error("Error:", res.status, json);
    process.exit(1);
  }

  console.log("Response:", JSON.stringify(json, null, 2));
  console.log("\nRun accepted. Briefs will be generated asynchronously.");
  if (waitForCompletion) {
    console.log("(Waited for completion; check runner logs and DynamoDB for results.)");
  }
}

async function checkScheduler(): Promise<void> {
  try {
    const { SchedulerClient, ListSchedulesCommand, GetScheduleCommand, ListScheduleExecutionsCommand } = await import(
      "@aws-sdk/client-scheduler"
    );
    const region = process.env.AWS_REGION ?? "us-east-1";
    const client = new SchedulerClient({ region });

    const result = await client.send(new ListSchedulesCommand({}));
    const briefSchedules = (result.Schedules ?? []).filter(
      (s) => s.Name?.includes("briefs") || s.Name?.includes("apac") || s.Name?.includes("international")
    );

    console.log("\n=== EventBridge Scheduler (brief-related) ===\n");
    console.log(`Found ${briefSchedules.length} schedule(s).\n`);

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    for (const schedule of briefSchedules) {
      const name = schedule.Name!;
      const details = await client.send(new GetScheduleCommand({ Name: name })).catch(() => null);
      const executions = await client
        .send(new ListScheduleExecutionsCommand({ Name: name, MaxResults: 10 }))
        .catch(() => ({ ScheduleExecutions: [] }));

      const recent = (executions.ScheduleExecutions ?? []).filter((e) => {
        const d = e.ExecutionDate ? new Date(e.ExecutionDate) : null;
        return d && d >= oneDayAgo;
      });

      console.log(`  ${name}`);
      console.log(`    State: ${schedule.State}`);
      console.log(`    Expression: ${details?.ScheduleExpression ?? schedule.ScheduleExpression ?? "N/A"}`);
      console.log(`    Executions (last 24h): ${recent.length}`);
      if (recent.length > 0 && recent[0].ExecutionDate) {
        console.log(`    Last: ${new Date(recent[0].ExecutionDate).toISOString()} (${recent[0].Status ?? "?"})`);
      } else if ((executions.ScheduleExecutions ?? []).length > 0 && executions.ScheduleExecutions![0].ExecutionDate) {
        const last = executions.ScheduleExecutions![0];
        console.log(`    Last (any): ${new Date(last.ExecutionDate!).toISOString()} (${last.Status ?? "?"})`);
      }
      console.log("");
    }
  } catch (err: any) {
    console.error("Scheduler check failed (need AWS credentials and permissions):", err.message);
  }
}

async function runDiagnose(): Promise<void> {
  console.log("\n=== Running diagnose-missing-briefs ===\n");
  const { spawn } = await import("node:child_process");
  const { join } = await import("node:path");
  return new Promise((resolve) => {
    const scriptPath = join(process.cwd(), "scripts", "diagnose-missing-briefs.ts");
    const child = spawn(
      "pnpm",
      ["exec", "tsx", scriptPath],
      { stdio: "inherit", cwd: process.cwd(), shell: process.platform === "win32" }
    );
    child.on("close", (code) => {
      if (code !== 0) console.error("Diagnose exited with code", code);
      resolve();
    });
  });
}

async function main(): Promise<void> {
  const cmd = process.argv[2]?.toLowerCase();
  const wait = process.argv.includes("--wait");

  if (cmd === "run") {
    await triggerRun(wait);
    return;
  }

  if (cmd === "check") {
    await checkScheduler();
    await runDiagnose();
    console.log("\nTo trigger a manual run:");
    console.log("  RUNNER_BASE_URL=<runner-url> CRON_SECRET=<secret> pnpm exec tsx scripts/trigger-brief-run.ts run");
    return;
  }

  console.log("Usage:");
  console.log("  trigger-brief-run.ts run [--wait]   Trigger a brief run (needs RUNNER_BASE_URL, CRON_SECRET)");
  console.log("  trigger-brief-run.ts check         Check EventBridge Scheduler + run diagnostics");
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
