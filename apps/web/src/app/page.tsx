import Link from "next/link";
import { BriefsTable } from "../components/BriefsTable";
import { CoverageMatrix } from "../components/CoverageMatrix";
import { LiveMarketTicker } from "../components/LiveMarketTicker";
import { REGIONS, BriefPost, RegionSlug } from "@proof/shared";
import { fetchLatest, fetchLatestByPortfolio } from "../lib/api";
import { getExecutiveDashboardData } from "../lib/executive-dashboard";

// Compact headline card
function HeadlineCard({ article }: { article: { title: string; url: string; source: string; publishedAt: string; category: string } }) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-lg border border-border bg-card p-3 hover:border-primary/40 hover:shadow-sm transition-all"
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
        <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-medium uppercase">
          {article.category}
        </span>
        <span>{article.source}</span>
        <span>•</span>
        <span>{new Date(article.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
      </div>
      <p className="text-sm font-medium text-foreground line-clamp-2 leading-snug">{article.title}</p>
    </a>
  );
}

export default async function GlobalDashboard() {
  const [auBriefs, usBriefs, auByPortfolio, usByPortfolio, executiveDashboard] = await Promise.all([
    fetchLatest("au"),
    fetchLatest("us-mx-la-lng"),
    fetchLatestByPortfolio("au"),
    fetchLatestByPortfolio("us-mx-la-lng"),
    getExecutiveDashboardData()
  ]);

  const allBriefs = [...auBriefs, ...usBriefs]
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, 15);

  const briefsByRegion: Record<RegionSlug, BriefPost[]> = {
    au: auByPortfolio,
    "us-mx-la-lng": usByPortfolio
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground sm:text-2xl">
            Category Intelligence Hub
          </h1>
          <p className="text-sm text-muted-foreground">
            Market data and intelligence across all categories
          </p>
        </div>
        <Link href="/chat" className="btn-primary text-sm">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          Ask AI
        </Link>
      </div>

      {/* Market Indices - Compact Strip */}
      <div className="rounded-lg border border-border bg-card p-4">
        <LiveMarketTicker showHeader={true} />
      </div>

      {/* News Headlines - Compact Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Industry Headlines</h2>
          <span className="text-xs text-muted-foreground">
            Updated {new Date(executiveDashboard.generatedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {executiveDashboard.articles.slice(0, 8).map((article) => (
            <HeadlineCard key={`${article.source}-${article.title}`} article={article} />
          ))}
        </div>
      </div>

      {/* Coverage Matrix */}
      <CoverageMatrix briefsByRegion={briefsByRegion} />

      {/* Latest Briefs */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Latest Intelligence Briefs</h2>
          <span className="text-xs text-muted-foreground">{allBriefs.length} briefs</span>
        </div>
        <BriefsTable briefs={allBriefs} showRegion={true} />
      </div>
    </div>
  );
}
