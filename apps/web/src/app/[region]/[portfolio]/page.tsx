import { redirect } from "next/navigation";
import { RegionSlug, REGIONS } from "@proof/shared";

interface PageProps {
  params: Promise<{ region: RegionSlug; portfolio: string }>;
}

/**
 * Legacy region-portfolio route redirects to the unified category overview.
 */
export default async function LegacyPortfolioRoute({ params }: PageProps) {
  const { region, portfolio } = await params;
  const regionName = REGIONS[region]?.city ?? "Region";
  redirect(`/portfolio/${portfolio}?refRegion=${encodeURIComponent(regionName)}`);
}

