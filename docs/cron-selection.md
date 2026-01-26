# Cron selection logic (baseline)

## Current selection rules
- Runner `/cron` accepts `regions`/`region` plus optional `agentIds`.
- If `agentIds` is present and non-empty, the run is limited to those IDs.
- If no `agentIds` are provided, all configured agents are eligible.
- For scheduled runs (`scheduled: true`), each region is checked against its localized run window (APAC/International).
  - If outside the window and not forced, the run is deferred unless no region is in-window, in which case a catch-up run is forced.

## Where it can skip today
- A scheduled run outside the run window can be deferred, so missing runs rely on the next schedule (or the catch-up fallback).
- If a scheduler call includes a partial `agentIds` list, any drift in that list prevents omitted agents from running.
