import Link from "next/link";
import { PortfolioNav } from "../../../components/PortfolioNav";
import { BriefsTable } from "../../../components/BriefsTable";
import { LiveMarketTicker } from "../../../components/LiveMarketTicker";
import { RegionSlug, portfolioLabel, REGIONS, findPortfolio } from "@proof/shared";
import { categoryForPortfolio, CATEGORY_META } from "@proof/shared";
import { fetchPosts } from "../../../lib/api";
import { CmTodayPanel } from "../../../components/cm/CmTodayPanel";
import { CmSupplierRadar } from "../../../components/cm/CmSupplierRadar";
import { CmNegotiationLevers } from "../../../components/cm/CmNegotiationLevers";
import { CmDeltaCard } from "../../../components/cm/CmDeltaCard";
import { CmMarketNotesCard } from "../../../components/cm/CmMarketNotesCard";
import { CmQuickLinks } from "../../../components/cm/CmQuickLinks";

export default async function PortfolioPage({ params }: { params: Promise<{ region: RegionSlug; portfolio: string }> }) {
  const { region, portfolio } = await params;
  const briefs = await fetchPosts({ region, portfolio, limit: 20 });
  const portfolioData = findPortfolio(portfolio);
  const category = categoryForPortfolio(portfolio);
  const meta = CATEGORY_META[category];
  const latestBrief = briefs[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Link href="/" className="hover:text-foreground transition-colors">Dashboard</Link>
            <span>/</span>
            <Link href={`/${region}`} className="hover:text-foreground transition-colors">{REGIONS[region].city}</Link>
            <span>/</span>
            <span className="text-foreground">{portfolioLabel(portfolio)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: meta.color }} />
            <h1 className="text-xl font-bold text-foreground sm:text-2xl">{portfolioLabel(portfolio)}</h1>
          </div>
          {portfolioData?.description && (
            <p className="mt-1 text-sm text-muted-foreground max-w-xl">{portfolioData.description}</p>
          )}
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-muted-foreground">
            <span className="font-semibold text-foreground">{briefs.length}</span> briefs
          </span>
          <Link href={`/chat?region=${region}&portfolio=${portfolio}`} className="btn-secondary text-sm">Ask AI</Link>
        </div>
      </div>

      {/* Category Manager Workbench */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m2-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-sm font-semibold text-foreground">Category Manager Workbench</h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <CmTodayPanel brief={latestBrief} />
            <CmSupplierRadar brief={latestBrief} />
            <CmNegotiationLevers brief={latestBrief} />
            <CmMarketNotesCard brief={latestBrief} />
            <CmDeltaCard brief={latestBrief} />
          </div>
          <div className="space-y-4 lg:col-span-1">
            <CmQuickLinks brief={latestBrief} region={region} portfolio={portfolio} />
          </div>
        </div>
      </div>

      {/* Market Indices */}
      <div className="rounded-lg border border-border bg-card p-4">
        <LiveMarketTicker showHeader={true} />
      </div>

      {/* Category Navigation */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Other Categories</h2>
        <PortfolioNav region={region} activePortfolio={portfolio} />
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
