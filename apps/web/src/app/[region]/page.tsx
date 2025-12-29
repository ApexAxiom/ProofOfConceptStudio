import Link from "next/link";
import { RegionTabs } from "../../components/RegionTabs";
import { PortfolioNav } from "../../components/PortfolioNav";
import { BriefsTable } from "../../components/BriefsTable";
import { LiveMarketTicker } from "../../components/LiveMarketTicker";
import { RegionSlug, REGIONS, PORTFOLIOS } from "@proof/shared";
import { fetchLatestByPortfolio } from "../../lib/api";

export default async function RegionPage({ params }: { params: Promise<{ region: RegionSlug }> }) {
  const { region } = await params;
  const briefs = await fetchLatestByPortfolio(region);
  const portfoliosWithBriefs = new Set(briefs.map(b => b.portfolio)).size;
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Link href="/" className="hover:text-foreground transition-colors">Dashboard</Link>
            <span>/</span>
            <span className="text-foreground">{REGIONS[region].label}</span>
          </div>
          <h1 className="text-xl font-bold text-foreground sm:text-2xl">
            {REGIONS[region].label}
          </h1>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-muted-foreground">
            <span className="font-semibold text-foreground">{briefs.length}</span> briefs
          </span>
          <span className="text-muted-foreground">
            <span className="font-semibold text-foreground">{portfoliosWithBriefs}</span> active categories
          </span>
          <Link href="/chat" className="btn-secondary text-sm">Ask AI</Link>
        </div>
      </div>

      {/* Region Tabs */}
      <RegionTabs activeRegion={region} showGlobalTab={true} />

      {/* Market Indices */}
      <div className="rounded-lg border border-border bg-card p-4">
        <LiveMarketTicker showHeader={true} />
      </div>
      
      {/* Category Filter */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Browse by Category</h2>
        <PortfolioNav region={region} />
      </div>
      
      {/* Briefs Table */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Intelligence Briefs</h2>
        {briefs.length > 0 ? (
          <BriefsTable briefs={briefs} showRegion={false} />
        ) : (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 py-12 text-center">
            <svg className="h-10 w-10 text-muted-foreground mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            <h4 className="text-base font-semibold text-foreground">No briefs yet</h4>
            <p className="mt-1 text-sm text-muted-foreground">Briefs will appear here once runs complete.</p>
          </div>
        )}
      </div>
    </div>
  );
}
