import Link from "next/link";
import { BriefsTable } from "../../../components/BriefsTable";
import { CategoryMarketTicker } from "../../../components/CategoryMarketTicker";
import { PORTFOLIOS, categoryForPortfolio, CATEGORY_META, BriefPost, RegionSlug } from "@proof/shared";
import { fetchPosts } from "../../../lib/api";
import { getExecutiveDashboardData } from "../../../lib/executive-dashboard";

interface CategoryDashboardProps {
  params: Promise<{ category: string }>;
}

// Headline card with image
function HeadlineCard({ article }: { 
  article: { title: string; url: string; source: string; publishedAt: string; category: string; summary?: string; imageUrl?: string } 
}) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="article-card"
    >
      {article.imageUrl && (
        <div className="article-card-image">
          <img 
            src={article.imageUrl} 
            alt={article.title}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </div>
      )}
      <div className="article-card-content">
        <div className="article-card-meta">
          <span className="article-card-badge">{article.category}</span>
          <span>{article.source}</span>
          <span>•</span>
          <span>{new Date(article.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
        </div>
        <p className="article-card-title">{article.title}</p>
        {article.summary && (
          <p className="article-card-summary">{article.summary}</p>
        )}
      </div>
    </a>
  );
}

export default async function CategoryDashboard({ params }: CategoryDashboardProps) {
  const { category: portfolioSlug } = await params;
  
  // Find the portfolio by slug
  const portfolio = PORTFOLIOS.find(p => p.slug === portfolioSlug);
  
  // If not found, show error
  if (!portfolio) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground mb-2">Category Not Found</h2>
          <p className="text-muted-foreground mb-4">The category "{portfolioSlug}" does not exist.</p>
          <Link href="/" className="btn-primary">Back to Dashboard</Link>
        </div>
      </div>
    );
  }
  
  const categoryGroup = categoryForPortfolio(portfolio.slug);
  const meta = CATEGORY_META[categoryGroup];
  
  // Fetch briefs and headlines in parallel
  const [executiveDashboard, auBriefs, usBriefs] = await Promise.all([
    getExecutiveDashboardData(),
    fetchPosts({ region: "au", portfolio: portfolio.slug, limit: 15 }).catch(() => [] as BriefPost[]),
    fetchPosts({ region: "us-mx-la-lng", portfolio: portfolio.slug, limit: 15 }).catch(() => [] as BriefPost[])
  ]);
  
  const allBriefs = [...auBriefs, ...usBriefs]
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, 25);

  // Get articles for the headlines
  const apacArticles = executiveDashboard.apacArticles.slice(0, 3);
  const intlArticles = executiveDashboard.internationalArticles.slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Link href="/" className="hover:text-foreground transition-colors">Dashboard</Link>
            <span>/</span>
            <span className="text-foreground">{portfolio.label}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: meta.color }} />
            <h1 className="text-xl font-bold text-foreground sm:text-2xl">{portfolio.label}</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">
            {portfolio.description}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link href="/chat" className="btn-secondary text-sm">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            Ask AI
          </Link>
        </div>
      </div>

      {/* Market Indices - Category Specific */}
      <div className="rounded-lg border border-border bg-card p-4">
        <CategoryMarketTicker category={categoryGroup} />
      </div>

      {/* Intelligence Briefs */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Intelligence Briefs</h2>
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
              Briefs for {portfolio.label} will appear here once runs complete.
            </p>
          </div>
        )}
      </div>

      {/* Headlines Grid - Split by Region */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* APAC Headlines */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">🌏</span>
            <h2 className="text-sm font-semibold text-foreground">APAC Market Intel</h2>
          </div>
          <div className="grid gap-3">
            {apacArticles.map((article, idx) => (
              <HeadlineCard key={`apac-${idx}`} article={article} />
            ))}
          </div>
        </div>

        {/* International Headlines */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">🌎</span>
            <h2 className="text-sm font-semibold text-foreground">International Market Intel</h2>
          </div>
          <div className="grid gap-3">
            {intlArticles.map((article, idx) => (
              <HeadlineCard key={`intl-${idx}`} article={article} />
            ))}
          </div>
        </div>
      </div>

      {/* Quick Links to Region Views */}
      <div className="flex flex-wrap gap-2 pt-4 border-t border-border">
        <span className="text-xs text-muted-foreground mr-2">View by region:</span>
        <Link
          href={`/au/${portfolio.slug}`}
          className="px-3 py-1.5 rounded-md border border-border bg-card text-xs text-foreground hover:bg-muted/50 transition-colors"
        >
          🇦🇺 Australia
        </Link>
        <Link
          href={`/us-mx-la-lng/${portfolio.slug}`}
          className="px-3 py-1.5 rounded-md border border-border bg-card text-xs text-foreground hover:bg-muted/50 transition-colors"
        >
          🇺🇸 International
        </Link>
      </div>
    </div>
  );
}
