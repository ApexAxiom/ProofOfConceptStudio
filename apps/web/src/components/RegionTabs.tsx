import Link from "next/link";
import { REGION_LIST, RegionSlug } from "@proof/shared";

export function RegionTabs({ activeRegion }: { activeRegion: RegionSlug }) {
  return (
    <div className="flex gap-3 border-b pb-2">
      {REGION_LIST.map((region) => (
        <Link
          key={region.slug}
          href={region.slug === REGION_LIST[0].slug ? "/" : `/${region.slug}`}
          className={`px-3 py-2 rounded ${activeRegion === region.slug ? "bg-blue-600 text-white" : "bg-gray-100"}`}
        >
          {region.label}
        </Link>
      ))}
    </div>
  );
}
