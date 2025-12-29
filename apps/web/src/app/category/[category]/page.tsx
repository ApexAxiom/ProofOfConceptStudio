import Link from "next/link";
import { BriefsTable } from "../../../components/BriefsTable";
import { LiveMarketTicker } from "../../../components/LiveMarketTicker";
import { CategoryGroup, CATEGORY_META, categoryForPortfolio } from "@proof/shared";
import { PORTFOLIOS, BriefPost, RegionSlug } from "@proof/shared";
import { fetchPosts } from "../../../lib/api";

interface CategoryDashboardProps {
  params: Promise<{ category: string }>;
}

// Get all portfolios for a category
function getPortfoliosForCategory(category: CategoryGroup): string[] {
  return PORTFOLIOS
    .filter(p => categoryForPortfolio(p.slug) === category)
    .map(p => p.slug);
}

// Get relevant market indices for a category
function getIndicesForCategory(category: CategoryGroup) {
  // This will be populated with actual indices based on category
  // For now, return empty array - we'll use market data API
  return [];
}

export default async function CategoryDashboard({ params }: CategoryDashboardProps) {
  const { category } = await params;
  const categoryGroup = category as CategoryGroup;
  if (!CATEGORY_META[categoryGroup]) {
    return <div>Invalid category</div>;
  }
  const meta = CATEGORY_META[categoryGroup];
  const portfolioSlugs = getPortfoliosForCategory(categoryGroup);
  
  // Fetch briefs for all portfolios in this category across all regions
  const allBriefs: BriefPost[] = [];
  const regions: RegionSlug[] = ["au", "us-mx-la-lng"];
  
  for (const portfolio of portfolioSlugs) {
    for (const region of regions) {
      try {
        const briefs = await fetchPosts({ region, portfolio, limit: 10 });
        allBriefs.push(...briefs);
      } catch (error) {
        console.error(`Error fetching briefs for ${portfolio} in ${region}:`, error);
      }
    }
  }
  
  // Sort by published date, most recent first
  const sortedBriefs = allBriefs
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, 50);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Link href="/" className="hover:text-foreground transition-colors">Dashboard</Link>
            <span>/</span>
            <span className="text-foreground font-medium">{meta.label}</span>
          </div>
          <div className="flex items-center gap-3">
            <span 
              className="h-3 w-3 rounded-full" 
              style={{ backgroundColor: meta.color }}
            />
            <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
              {meta.label} Category Dashboard
            </h1>
          </div>
          <p className="mt-2 text-muted-foreground">
            Market indices and intelligence briefs for {meta.label.toLowerCase()} portfolios
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

      {/* Market Indices - Live Tickers */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center gap-3">
          <div 
            className="flex h-10 w-10 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${meta.color}20`, color: meta.color }}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground">Market Indices</h2>
            <p className="text-sm text-muted-foreground">Live market data for {meta.label.toLowerCase()} category</p>
          </div>
        </div>
        <LiveMarketTicker />
        <p className="mt-3 text-xs text-muted-foreground">
          Click on any index to view the source. Data updates every 15 minutes.
        </p>
      </div>

      {/* Intelligence Briefs */}
      <div>
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-foreground">Intelligence Briefs</h2>
          <p className="text-sm text-muted-foreground">
            Latest briefs across all {meta.label.toLowerCase()} portfolios
          </p>
        </div>
        
        {sortedBriefs.length > 0 ? (
          <BriefsTable briefs={sortedBriefs} showRegion={true} />
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 py-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <svg className="h-8 w-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <h4 className="text-lg font-semibold text-foreground">No briefs yet</h4>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              Intelligence briefs for {meta.label.toLowerCase()} portfolios will appear here once the automated runs complete.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

