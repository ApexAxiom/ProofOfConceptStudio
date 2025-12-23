import { RunWindow } from "./types.js";

/**
 * Determine run window (am/pm) for a given date in America/Chicago time.
 */
export function runWindowFromDate(date: Date): RunWindow {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour: "2-digit",
    hour12: false
  });
  const parts = formatter.formatToParts(date);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  return hour < 12 ? "am" : "pm";
}

export function nowRunWindow(): RunWindow {
  return runWindowFromDate(new Date());
}

/**
 * Returns the nearest scheduled run time for AM (06:00) and PM (14:45) in America/Chicago.
 */
export function nextScheduledRun(date: Date = new Date()): { time: Date; window: RunWindow } {
  const tz = "America/Chicago";
  const toDate = (hour: number, minute: number): Date => {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
    const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
    return new Date(`${parts.year}-${parts.month}-${parts.day}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00-06:00`);
  };

  const am = toDate(6, 0);
  const pm = toDate(14, 45);
  const now = date.getTime();

  if (now < am.getTime()) return { time: am, window: "am" };
  if (now < pm.getTime()) return { time: pm, window: "pm" };
  const tomorrow = new Date(date.getTime() + 24 * 60 * 60 * 1000);
  const nextAm = new Date(toDate(6, 0).getTime() + 24 * 60 * 60 * 1000);
  return { time: nextAm > tomorrow ? nextAm : nextAm, window: "am" };
}
