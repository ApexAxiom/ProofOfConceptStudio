import { REGIONS, RunWindow } from "@proof/shared";

export const SCHEDULED_RUN_DAY_REASON = "scheduled_runs_only_tuesday_thursday";

const ALLOWED_WEEKDAYS = new Set(["Tue", "Thu"]);

function timeZoneForRunWindow(runWindow: RunWindow): string {
  return runWindow === "apac" ? REGIONS.au.timeZone : REGIONS["us-mx-la-lng"].timeZone;
}

export function localWeekdayForRunWindow(runWindow: RunWindow, now: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timeZoneForRunWindow(runWindow),
    weekday: "short"
  }).format(now);
}

export function isScheduledRunDay(runWindow: RunWindow, now: Date = new Date()): boolean {
  return ALLOWED_WEEKDAYS.has(localWeekdayForRunWindow(runWindow, now));
}

export function evaluateScheduledRunGuard(params: {
  scheduled: boolean;
  force?: boolean;
  dryRun?: boolean;
  runWindow: RunWindow;
  now?: Date;
}): { skipped: false } | { skipped: true; reason: typeof SCHEDULED_RUN_DAY_REASON; localWeekday: string } {
  if (!params.scheduled || params.force === true || params.dryRun === true) {
    return { skipped: false };
  }

  const now = params.now ?? new Date();
  const localWeekday = localWeekdayForRunWindow(params.runWindow, now);
  if (ALLOWED_WEEKDAYS.has(localWeekday)) {
    return { skipped: false };
  }

  return { skipped: true, reason: SCHEDULED_RUN_DAY_REASON, localWeekday };
}
