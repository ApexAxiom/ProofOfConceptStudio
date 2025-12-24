import { RegionTabs } from "../components/RegionTabs";
import { BriefCard } from "../components/BriefCard";
import { REGION_LIST, REGIONS } from "@proof/shared";
import { fetchLatestByPortfolio } from "../lib/api";

export default async function Home() {
  const region = REGION_LIST[0];
  const briefs = await fetchLatestByPortfolio(region.slug);
  return (
    <div className="space-y-6">
      <RegionTabs activeRegion={region.slug} />
      <div className="overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 p-6 text-white shadow">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-200">Latest by category</p>
        <h2 className="mt-2 text-2xl font-semibold">{REGIONS[region.slug].label}</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-100">
          A daily, citation-locked highlight for each portfolio with a hero image, overview, and quick takeaways. Click "Open brief" to see full markdown or jump to the source article.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {briefs.map((brief) => (
          <BriefCard key={brief.postId} brief={brief} />
        ))}
      </div>
    </div>
  );
}
