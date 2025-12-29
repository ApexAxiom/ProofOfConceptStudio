import Link from "next/link";
import { BriefsTable } from "../../../components/BriefsTable";
import { LiveMarketTicker } from "../../../components/LiveMarketTicker";
import { CategoryGroup, CATEGORY_META, categoryForPortfolio } from "@proof/shared";
import { PORTFOLIOS, BriefPost, RegionSlug } from "@proof/shared";
import { fetchPosts } from "../../../lib/api";

interface CategoryDashboardProps {
  params: Promise<{ category: string }>;
}

function getPortfoliosForCategory(category: CategoryGroup): string[] {
  return PORTFOLIOS
    .filter(p => categoryForPortfolio(p.slug) === category)
    .map(p => p.slug);
}

export default async function CategoryDashboard({ params }: CategoryDashboardProps) {
  const { category } = await params;
  const categoryGroup = category as CategoryGroup;
  
  if (!CATEGORY_META[categoryGroup]) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground mb-2">Category Not Found</h2>
          <p className="text-muted-foreground mb-4">The category "{category}" does not exist.</p>
          <Link href="/" className="btn-primary">Back to Dashboard</Link>
        </div>
      </div>
    );
  }
  
  const meta = CATEGORY_META[categoryGroup];
  const portfolioSlugs = getPortfoliosForCategory(categoryGroup);
  
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
  
  const sortedBriefs = allBriefs
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, 50);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Link href="/" className="hover:text-foreground transition-colors">Dashboard</Link>
            <span>/</span>
            <span className="text-foreground">{meta.label}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: meta.color }} />
            <h1 className="text-xl font-bold text-foreground sm:text-2xl">{meta.label}</h1>
          </div>
        </div>
        <Link href="/chat" className="btn-secondary text-sm">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          Ask AI
        </Link>
      </div>

      {/* Market Indices */}
      <div className="rounded-lg border border-border bg-card p-4">
        <LiveMarketTicker showHeader={true} />
      </div>

      {/* Intelligence Briefs */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Intelligence Briefs</h2>
          <span className="text-xs text-muted-foreground">{sortedBriefs.length} briefs</span>
        </div>
        
        {sortedBriefs.length > 0 ? (
          <BriefsTable briefs={sortedBriefs} showRegion={true} />
        ) : (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 py-12 text-center">
            <svg className="h-10 w-10 text-muted-foreground mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            <h4 className="text-base font-semibold text-foreground">No briefs yet</h4>
            <p className="mt-1 text-sm text-muted-foreground max-w-xs">
              Briefs for {meta.label.toLowerCase()} portfolios will appear here once runs complete.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
