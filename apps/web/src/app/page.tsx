import { RegionTabs } from "../components/RegionTabs";
import { BriefCard } from "../components/BriefCard";
import { REGION_LIST } from "@proof/shared";
import { fetchLatest } from "../lib/api";

export default async function Home() {
  const region = REGION_LIST[0];
  const briefs = await fetchLatest(region.slug);
  return (
    <div className="space-y-4">
      <RegionTabs activeRegion={region.slug} />
      <div className="grid md:grid-cols-2 gap-4">
        {briefs.map((brief) => (
          <BriefCard key={brief.postId} brief={brief} />
        ))}
      </div>
    </div>
  );
}
