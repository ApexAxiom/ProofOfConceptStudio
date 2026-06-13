import assert from "node:assert/strict";
import { evaluateScheduledRunGuard, isScheduledRunDay, localWeekdayForRunWindow } from "./schedule-guard.js";

const apacTuesdayLocal = new Date("2026-06-15T22:00:00.000Z"); // Tue 06:00 Australia/Perth
const apacWednesdayLocal = new Date("2026-06-16T22:00:00.000Z");
const intlThursdayLocal = new Date("2026-06-18T10:00:00.000Z"); // Thu 05:00 America/Chicago during CDT
const intlFridayLocal = new Date("2026-06-19T10:00:00.000Z");

assert.equal(localWeekdayForRunWindow("apac", apacTuesdayLocal), "Tue");
assert.equal(isScheduledRunDay("apac", apacTuesdayLocal), true);
assert.equal(isScheduledRunDay("apac", apacWednesdayLocal), false);

assert.equal(localWeekdayForRunWindow("international", intlThursdayLocal), "Thu");
assert.equal(isScheduledRunDay("international", intlThursdayLocal), true);
assert.equal(isScheduledRunDay("international", intlFridayLocal), false);

assert.deepEqual(
  evaluateScheduledRunGuard({ scheduled: true, runWindow: "international", now: intlFridayLocal }),
  { skipped: true, reason: "scheduled_runs_only_tuesday_thursday", localWeekday: "Fri" }
);
assert.deepEqual(
  evaluateScheduledRunGuard({ scheduled: true, force: true, runWindow: "international", now: intlFridayLocal }),
  { skipped: false }
);
assert.deepEqual(
  evaluateScheduledRunGuard({ scheduled: true, dryRun: true, runWindow: "international", now: intlFridayLocal }),
  { skipped: false }
);
assert.deepEqual(
  evaluateScheduledRunGuard({ scheduled: false, runWindow: "international", now: intlFridayLocal }),
  { skipped: false }
);

console.log("schedule-guard.smoke passed");
