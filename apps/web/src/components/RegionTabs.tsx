import Link from "next/link";
import { REGION_LIST, RegionSlug } from "@proof/shared";

export function RegionTabs({ activeRegion }: { activeRegion: RegionSlug }) {
  return (
    <div className="flex flex-wrap gap-2">
      {REGION_LIST.map((region) => (
        <Link
          key={region.slug}
          href={region.slug === REGION_LIST[0].slug ? "/" : `/${region.slug}`}
          className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
            activeRegion === region.slug
              ? "border-slate-900 bg-slate-900 text-white shadow"
              : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
          }`}
        >
          {region.label}
        </Link>
      ))}
    </div>
  );
}
