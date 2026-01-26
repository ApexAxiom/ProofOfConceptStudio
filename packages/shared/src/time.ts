import { REGIONS, RegionSlug } from "./regions.js";
import { RunWindow } from "./types.js";

const RUN_WINDOW_TIMEZONES: Record<RunWindow, { timeZone: string; hour: number; minute: number }> = {
  apac: { timeZone: "Australia/Perth", hour: 6, minute: 0 },
  international: { timeZone: "America/Chicago", hour: 6, minute: 0 }
};

/**
 * Map a region to its scheduled run window label.
 */
export function runWindowForRegion(region: RegionSlug): RunWindow {
  return region === "au" ? "apac" : "international";
}

/**
 * Determine the active run window based on a region and timestamp.
 * This keeps compatibility with existing callers that only provide a Date.
 */
export function runWindowFromDate(date: Date, region: RegionSlug = "us-mx-la-lng"): RunWindow {
  const target = RUN_WINDOW_TIMEZONES[runWindowForRegion(region)];
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: target.timeZone,
    hour: "2-digit",
    hour12: false
  });
  formatter.formatToParts(date); // formatting included for future extension
  return runWindowForRegion(region);
}

export function nowRunWindow(region: RegionSlug = "us-mx-la-lng"): RunWindow {
  return runWindowFromDate(new Date(), region);
}

/**
 * Returns the nearest scheduled run time for APAC (06:00 AWST) and International (06:00 CST).
 */
export function nextScheduledRun(date: Date = new Date()): { time: Date; window: RunWindow } {
  const toDate = (hour: number, minute: number, timeZone: string): Date => {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
    const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
    const iso = `${parts.year}-${parts.month}-${parts.day}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
    return new Date(`${iso}`);
  };

  const apac = toDate(RUN_WINDOW_TIMEZONES.apac.hour, RUN_WINDOW_TIMEZONES.apac.minute, RUN_WINDOW_TIMEZONES.apac.timeZone);
  const international = toDate(
    RUN_WINDOW_TIMEZONES.international.hour,
    RUN_WINDOW_TIMEZONES.international.minute,
    RUN_WINDOW_TIMEZONES.international.timeZone
  );

  const candidates = [
    { time: apac, window: "apac" as RunWindow },
    { time: international, window: "international" as RunWindow }
  ].sort((a, b) => a.time.getTime() - b.time.getTime());

  const now = date.getTime();
  const upcoming = candidates.find((c) => c.time.getTime() > now);
  if (upcoming) return upcoming;

  const nextDay = new Date(date.getTime() + 24 * 60 * 60 * 1000);
  const nextApac = new Date(apac.getTime() + 24 * 60 * 60 * 1000);
  return { time: nextApac > nextDay ? nextApac : nextDay, window: "apac" };
}

function formatDayKey(date: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value ?? "0000";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

/**
 * Returns the region-local brief day key (YYYY-MM-DD) for a given timestamp.
 */
export function getBriefDayKey(region: RegionSlug, date: Date = new Date()): string {
  const timeZone = REGIONS[region]?.timeZone ?? REGIONS["us-mx-la-lng"].timeZone;
  return formatDayKey(date, timeZone);
}
