import Link from "next/link";
import { RegionTabs } from "../../components/RegionTabs";
import { PortfolioNav } from "../../components/PortfolioNav";
import { BriefCard } from "../../components/BriefCard";
import { RegionSlug, REGIONS, PORTFOLIOS } from "@proof/shared";
import { fetchLatestByPortfolio } from "../../lib/api";

function StatsOverview({ briefs }: { briefs: { portfolio: string }[] }) {
  const portfoliosWithBriefs = new Set(briefs.map(b => b.portfolio)).size;
  
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="stat-card">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Total Briefs</p>
            <p className="text-2xl font-bold text-white">{briefs.length}</p>
          </div>
        </div>
      </div>
      
      <div className="stat-card">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Active Categories</p>
            <p className="text-2xl font-bold text-white">{portfoliosWithBriefs}</p>
          </div>
        </div>
      </div>
      
      <div className="stat-card">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Total Portfolios</p>
            <p className="text-2xl font-bold text-white">{PORTFOLIOS.length}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function RegionPage({ params }: { params: Promise<{ region: RegionSlug }> }) {
  const { region } = await params;
  const briefs = await fetchLatestByPortfolio(region);
  
  // Map briefs by portfolio for quick lookup
  const briefsByPortfolio: Record<string, typeof briefs[0]> = {};
  for (const b of briefs) {
    briefsByPortfolio[b.portfolio] = b;
  }
  
  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-700/50 bg-gradient-to-br from-slate-900 via-slate-800/80 to-slate-900 p-8 shadow-xl">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-violet-500/5 to-pink-500/5" />
        <div className="absolute -right-20 -top-20 h-60 w-60 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-60 w-60 rounded-full bg-violet-500/10 blur-3xl" />
        
        <div className="relative">
          <RegionTabs activeRegion={region} />
          
          <div className="mt-6">
            <div className="flex items-center gap-3 text-sm font-medium text-blue-400">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
              <span>Region Dashboard</span>
            </div>
            <h2 className="mt-2 text-3xl font-bold text-white md:text-4xl">
              {REGIONS[region].label}
            </h2>
            <p className="mt-3 max-w-2xl text-base text-slate-300">
              Browse the freshest intelligence brief for each portfolio in this region. Filter by category to focus on your specific area.
            </p>
          </div>
        </div>
      </div>
      
      {/* Stats */}
      <StatsOverview briefs={briefs} />
      
      {/* Portfolio Filter */}
      <div className="rounded-2xl border border-slate-700/50 bg-slate-900/50 p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Filter by Category</h3>
            <p className="mt-1 text-sm text-slate-400">Click to view briefs for a specific portfolio</p>
          </div>
        </div>
        <PortfolioNav region={region} />
      </div>
      
      {/* Briefs Grid */}
      <div>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-white">Latest Briefs</h3>
            <p className="mt-1 text-sm text-slate-400">
              Showing {briefs.length} intelligence briefs across all categories
            </p>
          </div>
          <Link href="/chat" className="btn-secondary text-sm">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            Ask AI
          </Link>
        </div>
        
        {briefs.length > 0 ? (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {briefs.map((brief) => (
              <BriefCard key={brief.postId} brief={brief} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-slate-900/30 py-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-800">
              <svg className="h-8 w-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <h4 className="text-lg font-semibold text-white">No briefs yet</h4>
            <p className="mt-2 max-w-sm text-sm text-slate-400">
              Intelligence briefs for this region will appear here once the automated runs complete.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
