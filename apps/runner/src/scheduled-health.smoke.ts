import assert from "node:assert/strict";
import { evaluateScheduledRunHealth } from "./scheduled-health.js";

const apacTuesdayAfterRun = new Date("2026-06-16T00:00:00.000Z"); // Tue 08:00 Australia/Perth
const apacWednesday = new Date("2026-06-17T00:00:00.000Z"); // Wed 08:00 Australia/Perth

assert.deepEqual(
  evaluateScheduledRunHealth({
    region: "au",
    runWindow: "apac",
    now: apacWednesday,
    records: []
  }),
  {
    region: "au",
    runWindow: "apac",
    briefDay: "2026-06-17",
    due: false,
    completed: true,
    published: true,
    completedCount: 0,
    publishedCount: 0,
    recordCount: 0,
    ok: true
  }
);

const missingDueRun = evaluateScheduledRunHealth({
  region: "au",
  runWindow: "apac",
  now: apacTuesdayAfterRun,
  records: []
});
assert.equal(missingDueRun.due, true);
assert.equal(missingDueRun.completed, false);
assert.equal(missingDueRun.published, false);
assert.equal(missingDueRun.ok, false);

const failedOnly = evaluateScheduledRunHealth({
  region: "au",
  runWindow: "apac",
  now: apacTuesdayAfterRun,
  records: [{ status: "failed", finishedAt: "2026-06-15T23:00:00.000Z", runWindow: "apac" }]
});
assert.equal(failedOnly.completed, true);
assert.equal(failedOnly.published, false);
assert.equal(failedOnly.ok, false);

const healthy = evaluateScheduledRunHealth({
  region: "au",
  runWindow: "apac",
  now: apacTuesdayAfterRun,
  records: [{ status: "succeeded", finishedAt: "2026-06-15T23:00:00.000Z", runWindow: "apac" }]
});
assert.equal(healthy.completed, true);
assert.equal(healthy.published, true);
assert.equal(healthy.ok, true);

const dryRunIgnored = evaluateScheduledRunHealth({
  region: "au",
  runWindow: "apac",
  now: apacTuesdayAfterRun,
  records: [{ status: "succeeded", finishedAt: "2026-06-15T23:00:00.000Z", dryRun: true, runWindow: "apac" }]
});
assert.equal(dryRunIgnored.completed, false);
assert.equal(dryRunIgnored.published, false);

console.log("scheduled-health.smoke passed");
