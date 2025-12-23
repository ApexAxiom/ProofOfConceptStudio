import { RegionTabs } from "../../components/RegionTabs";
import { PortfolioNav } from "../../components/PortfolioNav";
import { BriefCard } from "../../components/BriefCard";
import { REGION_LIST, RegionSlug } from "@proof/shared";
import { fetchLatest } from "../../lib/api";

export default async function RegionPage({ params }: { params: { region: RegionSlug } }) {
  const { region } = params;
  const briefs = await fetchLatest(region);
  return (
    <div className="space-y-4">
      <RegionTabs activeRegion={region} />
      <PortfolioNav region={region} />
      <div className="grid md:grid-cols-2 gap-4">
        {briefs.map((brief) => (
          <BriefCard key={brief.postId} brief={brief} />
        ))}
      </div>
    </div>
  );
}
