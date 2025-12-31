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
  BriefPost,
  RegionSlug
} from "@proof/shared";
import { fetchPosts } from "../../../lib/api";
import { VpRegionPanel } from "../../../components/vp/VpRegionPanel";

interface PortfolioDashboardProps {
  params: Promise<{ portfolio: string }>;
}

// Featured brief card - shows the latest brief prominently
function FeaturedBrief({ brief, region }: { brief: BriefPost; region: string }) {
  return (
    <Link 
      href={`/brief/${brief.postId}`}
      className="block rounded-lg border border-border bg-card p-4 hover:border-primary/40 hover:shadow-sm transition-all"
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
        <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
          {region === "au" ? "🇦🇺 APAC" : "🇺🇸 INTL"}
        </span>
        <span>{new Date(brief.publishedAt).toLocaleDateString("en-US", { 
          weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" 
        })}</span>
      </div>
      <h3 className="text-lg font-semibold text-foreground leading-snug mb-2">{brief.title}</h3>
      {brief.summary && (
        <p className="text-sm text-muted-foreground line-clamp-3">{brief.summary}</p>
      )}
      <div className="mt-3 text-sm text-primary font-medium">Read full brief →</div>
    </Link>
  );
}

// Source card component
function SourceCard({ source }: { source: PortfolioSource }) {
  const regionLabel = source.region === "apac" ? "🌏 APAC" : source.region === "intl" ? "🌎 INTL" : "🌐 Global";
  
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between gap-3 px-3 py-2 rounded-md border border-border bg-card hover:bg-muted/50 hover:border-primary/40 transition-all text-sm group"
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-xs text-muted-foreground">{regionLabel}</span>
        <span className="font-medium text-foreground truncate">{source.name}</span>
      </div>
      <svg className="h-4 w-4 text-muted-foreground group-hover:text-primary flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
      </svg>
    </a>
  );
}

export default async function PortfolioDashboard({ params }: PortfolioDashboardProps) {
  const { portfolio } = await params;
  
  // Find the portfolio
  const portfolioDef = PORTFOLIOS.find(p => p.slug === portfolio);
  if (!portfolioDef) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground mb-2">Portfolio Not Found</h2>
          <p className="text-muted-foreground mb-4">The portfolio "{portfolio}" does not exist.</p>
          <Link href="/" className="btn-primary">Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  const category = categoryForPortfolio(portfolio);
  const categoryMeta = CATEGORY_META[category];
  
  // Get sources split by region
  const apacSources = getPortfolioSources(portfolio, "apac");
  const intlSources = getPortfolioSources(portfolio, "intl");
  const globalSources = getPortfolioSources(portfolio).filter(s => s.region === "both");
  
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Link href="/" className="hover:text-foreground transition-colors">Dashboard</Link>
            <span>/</span>
            <span className="text-foreground">{categoryMeta.label}</span>
            <span>/</span>
            <span className="text-foreground">{portfolioLabel(portfolio)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: categoryMeta.color }} />
            <h1 className="text-xl font-bold text-foreground sm:text-2xl">{portfolioLabel(portfolio)}</h1>
          </div>
          {portfolioDef.description && (
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{portfolioDef.description}</p>
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

      {/* VP At-a-Glance */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14m0-4l-4.553-2.276A1 1 0 009 8.618v6.764a1 1 0 001.447.894L15 14m0-4v8m-5-8v8" />
          </svg>
          <h2 className="text-lg font-semibold text-foreground">VP At-a-Glance</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <VpRegionPanel label="APAC" brief={latestApacBrief} />
          <VpRegionPanel label="International" brief={latestIntlBrief} />
        </div>
      </div>

      {/* TODAY'S INTELLIGENCE BRIEFS - Featured at top */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h2 className="text-lg font-semibold text-foreground">Today's Intelligence Briefs</h2>
          </div>
          <span className="text-xs px-2 py-1 rounded bg-primary/10 text-primary font-medium">
            Updated {latestApacBrief || latestIntlBrief ? "today" : "awaiting first run"}
          </span>
        </div>

        {(latestApacBrief || latestIntlBrief) ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {latestApacBrief && (
              <FeaturedBrief brief={latestApacBrief} region="au" />
            )}
            {latestIntlBrief && (
              <FeaturedBrief brief={latestIntlBrief} region="us-mx-la-lng" />
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center">
            <svg className="h-12 w-12 text-muted-foreground mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h4 className="text-base font-semibold text-foreground mb-1">Intelligence briefs coming soon</h4>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Your dedicated Category Management AI Agent is analyzing sources and will publish the first daily brief shortly.
              Briefs are generated daily at 06:00 local time for each region.
            </p>
          </div>
        )}
      </div>

      {/* Market Indices */}
      <div className="rounded-lg border border-border bg-card p-4">
        <PortfolioMarketTicker portfolio={portfolio} />
      </div>

      {/* Brief History */}
      {allBriefs.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Brief History</h2>
          <BriefsTable briefs={allBriefs} showRegion={true} />
        </div>
      )}

      {/* Sources Grid */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Intelligence Sources</h2>
        
        <div className="grid gap-6 lg:grid-cols-2">
          {/* APAC Sources */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">🌏</span>
              <h3 className="text-sm font-medium text-foreground">APAC Sources</h3>
              <span className="text-xs text-muted-foreground">({apacSources.length + globalSources.length})</span>
            </div>
            <div className="space-y-1.5">
              {[...globalSources, ...apacSources].map((source) => (
                <SourceCard key={source.url} source={source} />
              ))}
              {apacSources.length === 0 && globalSources.length === 0 && (
                <p className="text-sm text-muted-foreground py-2">No APAC sources configured</p>
              )}
            </div>
          </div>

          {/* International Sources */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">🌎</span>
              <h3 className="text-sm font-medium text-foreground">International Sources</h3>
              <span className="text-xs text-muted-foreground">({intlSources.length + globalSources.length})</span>
            </div>
            <div className="space-y-1.5">
              {[...globalSources, ...intlSources].map((source) => (
                <SourceCard key={`intl-${source.url}`} source={source} />
              ))}
              {intlSources.length === 0 && globalSources.length === 0 && (
                <p className="text-sm text-muted-foreground py-2">No international sources configured</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Category Navigation */}
      <div className="pt-4 border-t border-border">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Part of {categoryMeta.label} category
          </span>
          <div className="flex gap-2">
            <Link href={`/au/${portfolio}`} className="text-xs px-2 py-1 rounded border border-border hover:bg-muted/50 transition-colors">
              🇦🇺 AU Region
            </Link>
            <Link href={`/us-mx-la-lng/${portfolio}`} className="text-xs px-2 py-1 rounded border border-border hover:bg-muted/50 transition-colors">
              🇺🇸 US Region
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
