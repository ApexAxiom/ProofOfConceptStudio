import Link from "next/link";
import { REGION_LIST, RegionSlug, REGIONS } from "@proof/shared";

function GlobeIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
    </svg>
  );
}

function getRegionFlag(slug: RegionSlug): string {
  const flags: Record<RegionSlug, string> = {
    "au": "🇦🇺",
    "us-mx-la-lng": "🇺🇸"
  };
  return flags[slug] || "🌍";
}

function getTimezoneShort(slug: RegionSlug): string {
  const zones: Record<RegionSlug, string> = {
    "au": "AWST",
    "us-mx-la-lng": "CST"
  };
  return zones[slug] || "UTC";
}

interface RegionTabsProps {
  activeRegion: RegionSlug;
  showGlobalTab?: boolean;
}

/**
 * Renders region selection tabs with the active region highlighted.
 */
export function RegionTabs({ activeRegion, showGlobalTab = false }: RegionTabsProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <GlobeIcon />
        </div>
        <span className="text-sm font-medium text-muted-foreground">Select Region</span>
      </div>
      
      <div className="flex flex-wrap gap-1.5 rounded-lg bg-muted p-1">
        {showGlobalTab && (
          <Link
            href="/"
            className="group relative flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-all duration-200 text-muted-foreground hover:bg-background hover:text-foreground"
          >
            <span className="text-base">🌐</span>
            <span className="hidden sm:inline">Global</span>
          </Link>
        )}
        {REGION_LIST.map((region) => {
          const isActive = activeRegion === region.slug;
          return (
            <Link
              key={region.slug}
              href={`/${region.slug}`}
              className={`group relative flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-all duration-200 ${
                isActive
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
              }`}
            >
              <span className="text-base">{getRegionFlag(region.slug)}</span>
              <span className="hidden sm:inline">{REGIONS[region.slug].city}</span>
              <span className="sm:hidden">{region.label}</span>
              {isActive && (
                <span className="ml-1 hidden rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary lg:inline">
                  {getTimezoneShort(region.slug)}
                </span>
              )}
              {!isActive && (
                <span className="ml-1 hidden text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60 lg:inline">
                  {getTimezoneShort(region.slug)}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
