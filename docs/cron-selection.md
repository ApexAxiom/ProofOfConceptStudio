# Cron selection logic

## Current selection rules
- Runner `/cron` accepts `regions`/`region` plus optional `agentIds`.
- If `agentIds` is present and non-empty, the run is limited to those IDs.
- If no `agentIds` are provided, all configured agents are eligible.
- Scheduled production runs are Tuesday/Thursday only in the local scheduler time zone:
  - APAC: 06:00 Australia/Perth, batches at 0/10/20 minutes.
  - International: 05:00 America/Chicago, batches at 0/10/20 minutes.
- For scheduled runs (`scheduled: true`), each region is checked against the Tuesday/Thursday local-day guard before normal run-window selection.
- If a scheduled request is not forced, not dry-run, and no requested region is on a Tuesday/Thursday local day, runner returns HTTP 200 with `{ "ok": true, "skipped": true, "reason": "scheduled_runs_only_tuesday_thursday" }`.
- Manual runs and forced scheduled runs bypass the Tuesday/Thursday day guard.
- A separate daily `/scheduled-health` check runs after each regional window. It emits healthy metrics on off-days and emits `ExpectedRunCompleted=0` or `ExpectedBriefPublished=0` only when a Tuesday/Thursday expected run did not complete or publish.

## Where it can skip today
- A scheduled run outside Tuesday/Thursday local time is skipped truthfully and does not publish placeholder content.
- A scheduled run outside the localized time window can still be deferred for regions not in-window.
- If a scheduler call includes a partial `agentIds` list, any drift in that list prevents omitted agents from running.
