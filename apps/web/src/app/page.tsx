import Link from "next/link";
import { BriefsTable } from "../components/BriefsTable";
import { CoverageMatrix } from "../components/CoverageMatrix";
import { LiveMarketTicker } from "../components/LiveMarketTicker";
import { REGION_LIST, REGIONS, PORTFOLIOS, BriefPost, RegionSlug } from "@proof/shared";
import { fetchLatest, fetchLatestByPortfolio } from "../lib/api";

// KPI Card Component
function KPICard({ 
  label, 
  value, 
  subtitle,
  icon 
}: { 
  label: string; 
  value: string | number; 
  subtitle?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="kpi-card">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="kpi-label">{label}</p>
          <p className="kpi-value mt-1">{value}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          )}
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
      </div>
    </div>
  );
}

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

export default async function GlobalDashboard() {
  // Fetch data for all regions in parallel
  const [auBriefs, usBriefs, auByPortfolio, usByPortfolio] = await Promise.all([
    fetchLatest("au"),
    fetchLatest("us-mx-la-lng"),
    fetchLatestByPortfolio("au"),
    fetchLatestByPortfolio("us-mx-la-lng")
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

  // Calculate KPIs
  const totalBriefs = auBriefs.length + usBriefs.length;
  const uniquePortfolios = new Set([
    ...auByPortfolio.map(b => b.portfolio),
    ...usByPortfolio.map(b => b.portfolio)
  ]).size;

  // Calculate freshness (find oldest brief to show staleness)
  const allLatestBriefs = [...auByPortfolio, ...usByPortfolio];
  let freshness = "—";
  if (allLatestBriefs.length > 0) {
    const oldestMs = Math.min(...allLatestBriefs.map(b => new Date(b.publishedAt).getTime()));
    const hoursOld = Math.floor((Date.now() - oldestMs) / (1000 * 60 * 60));
    if (hoursOld < 24) {
      freshness = `${hoursOld}h`;
    } else {
      freshness = `${Math.floor(hoursOld / 24)}d`;
    }
  }

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

      {/* KPI Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          label="Total Briefs"
          value={totalBriefs}
          subtitle="Across all regions"
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          }
        />
        <KPICard
          label="Active Portfolios"
          value={uniquePortfolios}
          subtitle={`of ${PORTFOLIOS.length} total`}
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6z" />
            </svg>
          }
        />
        <KPICard
          label="Oldest Coverage"
          value={freshness}
          subtitle="Most stale portfolio"
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <KPICard
          label="Active Regions"
          value={REGION_LIST.length}
          subtitle="Monitored globally"
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
            </svg>
          }
        />
      </div>

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
