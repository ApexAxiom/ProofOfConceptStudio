import Link from "next/link";
import { BriefsTable } from "../components/BriefsTable";
import { CoverageMatrix } from "../components/CoverageMatrix";
import { LiveMarketTicker } from "../components/LiveMarketTicker";
import { ExecutiveDashboard } from "../components/ExecutiveDashboard";
import { REGION_LIST, REGIONS, PORTFOLIOS, BriefPost, RegionSlug } from "@proof/shared";
import { fetchLatest, fetchLatestByPortfolio } from "../lib/api";
import { getExecutiveDashboardData } from "../lib/executive-dashboard";

// Region Overview Card
function RegionCard({ 
  region, 
  briefs,
  portfolioCount
}: { 
  region: typeof REGIONS["au"]; 
  briefs: BriefPost[];
  portfolioCount: number;
}) {
  const latestBrief = briefs.length > 0 ? briefs[0] : null;
  const latestTime = latestBrief 
    ? new Date(latestBrief.publishedAt).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      })
    : "No briefs yet";

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{region.slug === "au" ? "🇦🇺" : "🇺🇸"}</span>
          <div>
            <h3 className="font-semibold text-foreground">{region.label}</h3>
            <p className="text-sm text-muted-foreground">{region.city} • {region.slug === "au" ? "AWST" : "CST"}</p>
          </div>
        </div>
        <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
          <span className="status-dot live" />
          Active
        </span>
      </div>
      
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div>
          <p className="text-2xl font-bold text-foreground">{briefs.length}</p>
          <p className="text-xs text-muted-foreground">Briefs</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{portfolioCount}</p>
          <p className="text-xs text-muted-foreground">Portfolios</p>
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{latestTime}</p>
          <p className="text-xs text-muted-foreground">Last Updated</p>
        </div>
      </div>
      
      <Link
        href={`/${region.slug}`}
        className="btn-secondary w-full justify-center text-sm"
      >
        Open Region
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
        </svg>
      </Link>
    </div>
  );
}

async function fetchMarketData() {
  try {
    // For server-side fetching in Next.js, we need an absolute URL
    // In development, use localhost, in production use the VERCEL_URL
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';
    
    const response = await fetch(`${baseUrl}/api/market-data`, {
      next: { revalidate: 300 }, // Cache for 5 minutes
      cache: 'no-store', // For development, always fetch fresh data
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch market data: ${response.status}`);
    }
    
    const json = await response.json();
    return json.success ? json.data : [];
  } catch (error) {
    console.error('Error fetching market data:', error);
    // Return empty array on error so the page still renders
    return [];
  }
}

export default async function GlobalDashboard() {
  // Fetch data for all regions in parallel
  const [auBriefs, usBriefs, auByPortfolio, usByPortfolio, executiveDashboard, marketData] = await Promise.all([
    fetchLatest("au"),
    fetchLatest("us-mx-la-lng"),
    fetchLatestByPortfolio("au"),
    fetchLatestByPortfolio("us-mx-la-lng"),
    getExecutiveDashboardData(),
    fetchMarketData()
  ]);

  // Combine briefs for the table (sorted by publishedAt desc)
  const allBriefs = [...auBriefs, ...usBriefs]
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, 15);

  // Build coverage data
  const briefsByRegion: Record<RegionSlug, BriefPost[]> = {
    au: auByPortfolio,
    "us-mx-la-lng": usByPortfolio
  };

  const auPortfolioCount = new Set(auByPortfolio.map(b => b.portfolio)).size;
  const usPortfolioCount = new Set(usByPortfolio.map(b => b.portfolio)).size;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
            Supply Chain Intelligence Command Center
          </h1>
          <p className="mt-1 text-muted-foreground">
            Coverage, freshness, and market drivers across regions and categories.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/chat" className="btn-primary">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            Ask AI
          </Link>
        </div>
      </div>

      {/* Executive Dashboard */}
      <ExecutiveDashboard data={executiveDashboard} marketData={marketData} />

      {/* Region Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <RegionCard 
          region={REGIONS.au} 
          briefs={auByPortfolio}
          portfolioCount={auPortfolioCount}
        />
        <RegionCard 
          region={REGIONS["us-mx-la-lng"]} 
          briefs={usByPortfolio}
          portfolioCount={usPortfolioCount}
        />
      </div>

      {/* Coverage Matrix */}
      <CoverageMatrix briefsByRegion={briefsByRegion} />

      {/* Market Pulse */}
      <LiveMarketTicker />

      {/* Latest Briefs Table */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Latest Briefs Across Regions</h2>
            <p className="text-sm text-muted-foreground">Most recent intelligence briefs from all active regions</p>
          </div>
        </div>
        <BriefsTable briefs={allBriefs} showRegion={true} />
      </div>
    </div>
  );
}
