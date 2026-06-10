export type RegionSlug = "au" | "us-mx-la-lng";

export const REGIONS: Record<RegionSlug, { slug: RegionSlug; label: string; city: string; timeZone: string }>= {
  au: {
    slug: "au",
    label: "Australia (Perth)",
    city: "Perth",
    timeZone: "Australia/Perth"
  },
  "us-mx-la-lng": {
    slug: "us-mx-la-lng",
    label: "International (Houston)",
    city: "Houston",
    timeZone: "America/Chicago"
  }
};

export const REGION_LIST = Object.values(REGIONS);

/**
 * Returns a human readable label for a region slug.
 */
export function regionLabel(slug: RegionSlug): string {
  return REGIONS[slug]?.label ?? slug;
}

/**
 * Short badge label. The international region spans US/Mexico/LatAm/Senegal,
 * so it is rendered as "INTL" rather than a single country flag.
 */
export function regionShortLabel(slug: RegionSlug): string {
  return slug === "au" ? "AU" : "INTL";
}
