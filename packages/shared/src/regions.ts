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
    label: "US / Mexico / Louisiana LNG (Houston)",
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
