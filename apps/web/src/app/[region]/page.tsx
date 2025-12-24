import { RegionTabs } from "../../components/RegionTabs";
import { PortfolioNav } from "../../components/PortfolioNav";
import { BriefCard } from "../../components/BriefCard";
import { RegionSlug, REGIONS } from "@proof/shared";
import { fetchLatestByPortfolio } from "../../lib/api";

export default async function RegionPage({ params }: { params: Promise<{ region: RegionSlug }> }) {
  const { region } = await params;
  const briefs = await fetchLatestByPortfolio(region);
  return (
    <div className="space-y-6">
      <RegionTabs activeRegion={region} />
      <div className="overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 p-6 text-white shadow">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-200">Latest by category</p>
        <h2 className="mt-2 text-2xl font-semibold">{REGIONS[region].label}</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-100">Browse the freshest post for each portfolio in this region.</p>
      </div>
      <PortfolioNav region={region} />
      <div className="grid gap-4 md:grid-cols-2">
        {briefs.map((brief) => (
          <BriefCard key={brief.postId} brief={brief} />
        ))}
      </div>
    </div>
  );
}
