import { RegionTabs } from "../../../components/RegionTabs";
import { PortfolioNav } from "../../../components/PortfolioNav";
import { BriefCard } from "../../../components/BriefCard";
import { MarketSnapshot } from "../../../components/MarketSnapshot";
import { RegionSlug, indicesForRegion, portfolioLabel, REGIONS } from "@proof/shared";
import { fetchPosts } from "../../../lib/api";

export default async function PortfolioPage({ params }: { params: Promise<{ region: RegionSlug; portfolio: string }> }) {
  const { region, portfolio } = await params;
  const briefs = await fetchPosts({ region, portfolio, limit: 10 });
  const indices = indicesForRegion(portfolio, region);
  return (
    <div className="space-y-6">
      <RegionTabs activeRegion={region} />
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{REGIONS[region].label}</p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-900">{portfolioLabel(portfolio)}</h2>
        <p className="mt-2 text-sm text-slate-600">Latest briefs for this portfolio, plus market snapshot links.</p>
      </div>
      <PortfolioNav region={region} activePortfolio={portfolio} />
      <div className="grid gap-4 md:grid-cols-2">
        {briefs.map((brief) => (
          <BriefCard key={brief.postId} brief={brief} />
        ))}
      </div>
      <MarketSnapshot indices={indices} />
    </div>
  );
}
