import Link from "next/link";
import { RegionTabs } from "../../../components/RegionTabs";
import { PortfolioNav } from "../../../components/PortfolioNav";
import { BriefCard } from "../../../components/BriefCard";
import { MarketSnapshot } from "../../../components/MarketSnapshot";
import { RegionSlug, indicesForRegion, portfolioLabel, REGIONS, findPortfolio } from "@proof/shared";
import { fetchPosts } from "../../../lib/api";

function getCategoryColor(slug: string): { bg: string; border: string; text: string } {
  if (slug.includes("drill") || slug.includes("rig") || slug.includes("wells") || slug.includes("complet") || slug.includes("subsea") || slug.includes("project") || slug.includes("equipment") || slug.includes("decom")) {
    return { bg: "bg-amber-500/10", border: "border-amber-500/30", text: "text-amber-400" };
  }
  if (slug.includes("logistics") || slug.includes("marine") || slug.includes("aviation")) {
    return { bg: "bg-cyan-500/10", border: "border-cyan-500/30", text: "text-cyan-400" };
  }
  if (slug.includes("cyber") || slug.includes("it") || slug.includes("telecom")) {
    return { bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-400" };
  }
  if (slug.includes("services") || slug.includes("hr") || slug.includes("professional")) {
    return { bg: "bg-violet-500/10", border: "border-violet-500/30", text: "text-violet-400" };
  }
  if (slug.includes("facility") || slug.includes("site")) {
    return { bg: "bg-pink-500/10", border: "border-pink-500/30", text: "text-pink-400" };
  }
  if (slug.includes("mro") || slug.includes("materials")) {
    return { bg: "bg-slate-400/10", border: "border-slate-400/30", text: "text-slate-300" };
  }
  return { bg: "bg-blue-500/10", border: "border-blue-500/30", text: "text-blue-400" };
}

export default async function PortfolioPage({ params }: { params: Promise<{ region: RegionSlug; portfolio: string }> }) {
  const { region, portfolio } = await params;
  const briefs = await fetchPosts({ region, portfolio, limit: 10 });
  const indices = indicesForRegion(portfolio, region);
  const portfolioData = findPortfolio(portfolio);
  const colors = getCategoryColor(portfolio);

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-700/50 bg-gradient-to-br from-slate-900 via-slate-800/80 to-slate-900 p-8 shadow-xl">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-violet-500/5 to-pink-500/5" />
        <div className="absolute -right-20 -top-20 h-60 w-60 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-60 w-60 rounded-full bg-violet-500/10 blur-3xl" />
        
        <div className="relative">
          <RegionTabs activeRegion={region} />
          
          <div className="mt-6 flex items-start gap-4">
            <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${colors.bg} ${colors.text} shadow-lg`}>
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-3 text-sm font-medium text-slate-400">
                <span>{REGIONS[region].label}</span>
                <span className="text-slate-600">•</span>
                <span className="flex items-center gap-1.5">
                  <span className="status-dot live" />
                  Live Intelligence
                </span>
              </div>
              <h2 className="mt-2 text-3xl font-bold text-white">{portfolioLabel(portfolio)}</h2>
              {portfolioData?.description && (
                <p className="mt-3 max-w-2xl text-base text-slate-300">{portfolioData.description}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${colors.bg} ${colors.text}`}>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Briefs</p>
              <p className="text-2xl font-bold text-white">{briefs.length}</p>
            </div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Market Indices</p>
              <p className="text-2xl font-bold text-white">{indices.length}</p>
            </div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Run Schedule</p>
              <p className="text-2xl font-bold text-white">Daily</p>
            </div>
          </div>
        </div>
      </div>

      {/* Portfolio Filter */}
      <div className="rounded-2xl border border-slate-700/50 bg-slate-900/50 p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Browse Categories</h3>
            <p className="mt-1 text-sm text-slate-400">Switch to another portfolio in this region</p>
          </div>
        </div>
        <PortfolioNav region={region} activePortfolio={portfolio} />
      </div>

      {/* Briefs Grid */}
      <div>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-white">Intelligence Briefs</h3>
            <p className="mt-1 text-sm text-slate-400">
              Latest AI-generated briefs for {portfolioLabel(portfolio)}
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
              Intelligence briefs for {portfolioLabel(portfolio)} will appear here once the automated runs complete.
            </p>
          </div>
        )}
      </div>

      {/* Market Indices */}
      <MarketSnapshot indices={indices} />
    </div>
  );
}
