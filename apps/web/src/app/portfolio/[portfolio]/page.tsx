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

interface PortfolioDashboardProps {
  params: Promise<{ portfolio: string }>;
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
  
  // Fetch briefs for this portfolio
  const regions: RegionSlug[] = ["au", "us-mx-la-lng"];
  const briefResults = await Promise.all(
    regions.map(region => fetchPosts({ region, portfolio, limit: 15 }).catch(() => [] as BriefPost[]))
  );
  
  const allBriefs = briefResults.flat()
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
            <Link href={`/category/${category}`} className="hover:text-foreground transition-colors">{categoryMeta.label}</Link>
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

      {/* Market Indices */}
      <div className="rounded-lg border border-border bg-card p-4">
        <PortfolioMarketTicker portfolio={portfolio} />
      </div>

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

      {/* Intelligence Briefs */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Intelligence Briefs</h2>
          <span className="text-xs text-muted-foreground">{allBriefs.length} briefs</span>
        </div>
        
        {allBriefs.length > 0 ? (
          <BriefsTable briefs={allBriefs} showRegion={true} />
        ) : (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 py-12 text-center">
            <svg className="h-10 w-10 text-muted-foreground mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            <h4 className="text-base font-semibold text-foreground">No briefs yet</h4>
            <p className="mt-1 text-sm text-muted-foreground max-w-xs">
              Intelligence briefs will appear here once the AI agents complete their scheduled runs.
            </p>
          </div>
        )}
      </div>

      {/* Category Navigation */}
      <div className="pt-4 border-t border-border">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Part of <Link href={`/category/${category}`} className="text-primary hover:underline">{categoryMeta.label}</Link> category
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

