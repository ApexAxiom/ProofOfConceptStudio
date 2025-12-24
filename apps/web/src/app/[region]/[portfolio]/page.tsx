import { RegionTabs } from "../../../components/RegionTabs";
import { PortfolioNav } from "../../../components/PortfolioNav";
import { BriefCard } from "../../../components/BriefCard";
import { MarketSnapshot } from "../../../components/MarketSnapshot";
import { RegionSlug, indicesForRegion } from "@proof/shared";
import { fetchPosts } from "../../../lib/api";

export default async function PortfolioPage({ params }: { params: Promise<{ region: RegionSlug; portfolio: string }> }) {
  const { region, portfolio } = await params;
  const briefs = await fetchPosts({ region, portfolio, limit: 10 });
  const indices = indicesForRegion(portfolio, region);
  return (
    <div className="space-y-4">
      <RegionTabs activeRegion={region} />
      <PortfolioNav region={region} activePortfolio={portfolio} />
      <div className="grid md:grid-cols-2 gap-4">
        {briefs.map((brief) => (
          <BriefCard key={brief.postId} brief={brief} />
        ))}
      </div>
      <MarketSnapshot indices={indices} />
    </div>
  );
}
