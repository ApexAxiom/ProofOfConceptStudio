import { REGIONS, RegionSlug, getBriefDayKey } from "@proof/shared";

const COVERAGE_CUTOFF_HOUR: Record<RegionSlug, number> = {
  au: 6,
  "us-mx-la-lng": 5
};

function localHour(region: RegionSlug, now: Date): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: REGIONS[region].timeZone,
    hour: "numeric",
    hour12: false
  });
  const parts = formatter.formatToParts(now);
  return Number(parts.find((part) => part.type === "hour")?.value ?? "0");
}

/**
 * Returns the day key that should have coverage at the current point in time.
 * Before the region's scheduled publish cutoff, the expected day remains yesterday.
 */
export function expectedCoverageDayKey(region: RegionSlug, now = new Date()): string {
  const cutoffHour = COVERAGE_CUTOFF_HOUR[region] ?? 0;
  if (localHour(region, now) < cutoffHour) {
    return getBriefDayKey(region, new Date(now.getTime() - 24 * 60 * 60 * 1000));
  }
  return getBriefDayKey(region, now);
}
