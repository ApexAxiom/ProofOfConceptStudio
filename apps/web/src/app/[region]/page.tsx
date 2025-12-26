import Link from "next/link";
import { RegionTabs } from "../../components/RegionTabs";
import { PortfolioNav } from "../../components/PortfolioNav";
import { BriefsTable } from "../../components/BriefsTable";
import { BriefCard } from "../../components/BriefCard";
import { RegionSlug, REGIONS, PORTFOLIOS } from "@proof/shared";
import { fetchLatestByPortfolio } from "../../lib/api";

function StatsOverview({ briefs }: { briefs: { portfolio: string }[] }) {
  const portfoliosWithBriefs = new Set(briefs.map(b => b.portfolio)).size;
  
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="kpi-card">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Briefs</p>
            <p className="text-2xl font-bold text-foreground">{briefs.length}</p>
          </div>
        </div>
      </div>
      
      <div className="kpi-card">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Active Categories</p>
            <p className="text-2xl font-bold text-foreground">{portfoliosWithBriefs}</p>
          </div>
        </div>
      </div>
      
      <div className="kpi-card">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Portfolios</p>
            <p className="text-2xl font-bold text-foreground">{PORTFOLIOS.length}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function RegionPage({ params }: { params: Promise<{ region: RegionSlug }> }) {
  const { region } = await params;
  const briefs = await fetchLatestByPortfolio(region);
  
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Link href="/" className="hover:text-foreground transition-colors">Dashboard</Link>
            <span>/</span>
            <span className="text-foreground font-medium">{REGIONS[region].label}</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
            {REGIONS[region].label}
          </h1>
          <p className="mt-1 text-muted-foreground">
            Browse the freshest intelligence brief for each portfolio in this region.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/chat" className="btn-secondary">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            Ask AI
          </Link>
        </div>
      </div>

      {/* Region Tabs */}
      <RegionTabs activeRegion={region} showGlobalTab={true} />
      
      {/* Stats */}
      <StatsOverview briefs={briefs} />
      
      {/* Portfolio Filter */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3">
          <h3 className="font-semibold text-foreground">Filter by Category</h3>
          <p className="text-sm text-muted-foreground">Click to view briefs for a specific portfolio</p>
        </div>
        <PortfolioNav region={region} />
      </div>
      
      {/* Briefs Table */}
      <div>
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-foreground">Latest Briefs</h2>
          <p className="text-sm text-muted-foreground">
            Showing {briefs.length} intelligence briefs across all categories
          </p>
        </div>
        
        {briefs.length > 0 ? (
          <BriefsTable briefs={briefs} showRegion={false} />
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 py-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <svg className="h-8 w-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <h4 className="text-lg font-semibold text-foreground">No briefs yet</h4>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              Intelligence briefs for this region will appear here once the automated runs complete.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
