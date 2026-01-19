import Link from "next/link";
import { BriefsTable } from "../../../components/BriefsTable";
import { PortfolioMarketTicker } from "../../../components/PortfolioMarketTicker";
import {
  PORTFOLIOS,
  portfolioLabel,
  categoryForPortfolio,
  CATEGORY_META,
  getPortfolioSources,
  PortfolioSource,
  BriefPost
} from "@proof/shared";
import { fetchPosts } from "../../../lib/api";
import { getPortfolioPlaybook } from "../../../lib/portfolio-playbook";

interface PortfolioDashboardProps {
  params: Promise<{ portfolio: string }>;
  searchParams?: Promise<{ tab?: string }>;
}

// Featured brief card - Premium styling
function FeaturedBrief({ brief, region }: { brief: BriefPost; region: string }) {
  return (
    <Link 
      href={`/brief/${brief.postId}`}
      className="group block rounded-xl border border-border bg-card p-5 hover:border-primary/40 transition-all duration-300"
      style={{
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.12)"
      }}
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
        <span className="px-2 py-1 rounded-md bg-primary/10 border border-primary/20 text-primary font-semibold">
          {region === "au" ? "🇦🇺 APAC" : "🇺🇸 INTL"}
        </span>
        <span className="font-mono">{new Date(brief.publishedAt).toLocaleDateString("en-US", { 
          weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" 
        })}</span>
      </div>
      <h3 className="font-display text-lg font-bold text-foreground leading-snug mb-3 group-hover:text-primary transition-colors">
        {brief.title}
      </h3>
      {brief.summary && (
        <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">{brief.summary}</p>
      )}
      <div className="mt-4 flex items-center gap-2 text-sm text-primary font-semibold">
        Read full brief
        <svg className="h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
        </svg>
      </div>
    </Link>
  );
}

// Source card component - Premium styling
function SourceCard({ source }: { source: PortfolioSource }) {
  const regionLabel = source.region === "apac" ? "🌏 APAC" : source.region === "intl" ? "🌎 INTL" : "🌐 Global";
  
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-border bg-card hover:bg-secondary/50 hover:border-primary/30 transition-all duration-200 text-sm"
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-xs text-muted-foreground">{regionLabel}</span>
        <span className="font-medium text-foreground truncate group-hover:text-primary transition-colors">{source.name}</span>
      </div>
      <svg className="h-4 w-4 text-muted-foreground group-hover:text-primary flex-shrink-0 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
      </svg>
    </a>
  );
}

export default async function PortfolioDashboard({ params, searchParams }: PortfolioDashboardProps) {
  const { portfolio } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const tabParam = resolvedSearchParams?.tab ?? "briefs";
  const activeTab = ["briefs", "playbook", "kpis", "suppliers"].includes(tabParam) ? tabParam : "briefs";
  
  // Find the portfolio
  const portfolioDef = PORTFOLIOS.find(p => p.slug === portfolio);
  if (!portfolioDef) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-secondary mx-auto mb-4 flex items-center justify-center">
            <span className="text-2xl">🔍</span>
          </div>
          <h2 className="font-display text-xl font-bold text-foreground mb-2">Portfolio Not Found</h2>
          <p className="text-muted-foreground mb-6">The portfolio &ldquo;{portfolio}&rdquo; does not exist.</p>
          <Link href="/" className="btn-primary">Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  const category = categoryForPortfolio(portfolio);
  const categoryMeta = CATEGORY_META[category];
  
  // Get sources and dedupe by URL
  const sources = getPortfolioSources(portfolio);
  const dedupedSources = Array.from(
    new Map(sources.map((source) => [source.url, source])).values()
  );
  
  // Fetch briefs for this portfolio - separate by region
  const [auBriefs, usBriefs] = await Promise.all([
    fetchPosts({ region: "au", portfolio, limit: 10 }).catch(() => [] as BriefPost[]),
    fetchPosts({ region: "us-mx-la-lng", portfolio, limit: 10 }).catch(() => [] as BriefPost[])
  ]);

  // Get latest briefs for each region
  const latestApacBrief = auBriefs[0];
  const latestIntlBrief = usBriefs[0];

  // All briefs for history table
  const allBriefs = [...auBriefs, ...usBriefs]
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, 20);

  const playbook = getPortfolioPlaybook(portfolio);
  const tabs = [
    { id: "briefs", label: "Briefs" },
    { id: "playbook", label: "Category Playbook" },
    { id: "kpis", label: "KPIs" },
    { id: "suppliers", label: "Suppliers" }
  ];

  return (
    <div className="space-y-10">
      {/* Header - Premium editorial styling */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Link href="/" className="hover:text-primary transition-colors">Dashboard</Link>
            <span className="text-border">/</span>
            <span>{categoryMeta.label}</span>
            <span className="text-border">/</span>
            <span className="text-foreground font-medium">{portfolioLabel(portfolio)}</span>
          </div>
          
          {/* Title with category indicator */}
          <div className="flex items-center gap-3">
            <span 
              className="h-3 w-3 rounded-full" 
              style={{ 
                backgroundColor: categoryMeta.color,
                boxShadow: `0 0 12px ${categoryMeta.color}50`
              }} 
            />
            <h1 className="font-display text-2xl font-bold text-foreground tracking-tight sm:text-3xl">
              {portfolioLabel(portfolio)}
            </h1>
          </div>
          
          {portfolioDef.description && (
            <p className="text-sm text-muted-foreground mt-2 max-w-2xl leading-relaxed">{portfolioDef.description}</p>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Link href="/chat" className="btn-secondary text-sm">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            Ask AI
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            href={`/portfolio/${portfolio}?tab=${tab.id}`}
            className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] ${
              activeTab === tab.id ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {activeTab === "briefs" && (
        <>
          {/* TODAY'S INTELLIGENCE BRIEFS - Featured section */}
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="accent-line" />
                <h2 className="font-display text-lg font-bold text-foreground">Today&apos;s Intelligence Briefs</h2>
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-[0.15em] px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary">
                Updated {latestApacBrief || latestIntlBrief ? "today" : "awaiting first run"}
              </span>
            </div>

            {(latestApacBrief || latestIntlBrief) ? (
              <div className="grid gap-5 lg:grid-cols-2">
                {latestApacBrief && (
                  <FeaturedBrief brief={latestApacBrief} region="au" />
                )}
                {latestIntlBrief && (
                  <FeaturedBrief brief={latestIntlBrief} region="us-mx-la-lng" />
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border bg-secondary/30 p-10 text-center">
                <div className="w-14 h-14 rounded-full bg-secondary mx-auto mb-4 flex items-center justify-center">
                  <svg className="h-7 w-7 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h4 className="font-display text-base font-semibold text-foreground mb-2">Intelligence briefs coming soon</h4>
                <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
                  Your dedicated Category Management AI Agent is analyzing sources and will publish the first daily brief shortly
                  Briefs are generated daily at 06:00 local time for each region.
                </p>
              </div>
            )}
          </div>

          {/* Market Indices - Premium card */}
          <div className="rounded-xl border border-border bg-card p-5">
            <PortfolioMarketTicker portfolio={portfolio} />
          </div>

          {/* Brief History */}
          {allBriefs.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="accent-line" />
                <h2 className="font-display text-sm font-semibold text-foreground uppercase tracking-wider">Brief History</h2>
              </div>
              <BriefsTable briefs={allBriefs} showRegion={true} variant="history" />
            </div>
          )}

          {/* Sources Accordion */}
          <details className="rounded-xl border border-border bg-card">
            <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-foreground flex items-center justify-between">
              <span>Sources ({dedupedSources.length})</span>
              <span className="text-xs text-muted-foreground">Expand</span>
            </summary>
            <div className="space-y-2 px-5 pb-5 pt-2">
              {dedupedSources.length > 0 ? (
                dedupedSources.map((source) => (
                  <SourceCard key={source.url} source={source} />
                ))
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">No sources configured</p>
              )}
            </div>
          </details>
        </>
      )}

      {activeTab === "playbook" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold text-foreground">Category Playbook</h2>
            <p className="text-xs text-muted-foreground mt-1">Weekly refresh. Built to keep daily briefs concise.</p>
          </div>
          {playbook ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-border bg-card p-5">
                <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Key KPIs</h3>
                <ul className="mt-3 space-y-2 text-sm text-foreground list-disc pl-4">
                  {playbook.kpis.map((kpi) => (
                    <li key={kpi}>{kpi}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border border-border bg-card p-5">
                <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Negotiation Levers</h3>
                <ul className="mt-3 space-y-2 text-sm text-foreground list-disc pl-4">
                  {playbook.levers.map((lever) => (
                    <li key={lever}>{lever}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-secondary/30 p-8 text-center">
              <p className="text-sm text-muted-foreground">Playbook details will be added after the first category cycle.</p>
            </div>
          )}
        </div>
      )}

      {activeTab === "kpis" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold text-foreground">KPIs</h2>
            <p className="text-xs text-muted-foreground mt-1">Sparkline trends roll up weekly using the playbook KPIs.</p>
          </div>
          {playbook ? (
            <div className="grid gap-3 md:grid-cols-2">
              {playbook.kpis.map((kpi) => (
                <div key={kpi} className="rounded-lg border border-border bg-card p-4">
                  <p className="text-sm font-medium text-foreground">{kpi}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Trend view coming soon.</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">KPIs will appear once the playbook is configured.</p>
          )}
        </div>
      )}

      {activeTab === "suppliers" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold text-foreground">Suppliers</h2>
            <p className="text-xs text-muted-foreground mt-1">Top vendors and notes captured from briefs.</p>
          </div>
          <div className="rounded-xl border border-dashed border-border bg-secondary/30 p-8 text-center">
            <p className="text-sm text-muted-foreground">Supplier notes will populate as briefs are published.</p>
          </div>
        </div>
      )}

      {/* Category Navigation - Premium footer */}
      <div className="pt-6 border-t border-border">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <span className="text-sm text-muted-foreground">
            Part of <span className="font-medium text-foreground">{categoryMeta.label}</span> category
          </span>
          <div className="flex gap-2">
            <Link href={`/au/${portfolio}`} className="btn-ghost text-xs py-1.5">
              🇦🇺 AU Region
            </Link>
            <Link href={`/us-mx-la-lng/${portfolio}`} className="btn-ghost text-xs py-1.5">
              🇺🇸 US Region
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
