import { LatestBriefsList } from "../components/LatestBriefsList";
import { LiveMarketTicker } from "../components/LiveMarketTicker";
import { fetchLatest } from "../lib/api";
import { getExecutiveDashboardData, ExecutiveArticle } from "../lib/executive-dashboard";

// Compact article card for news sections
function ArticleCard({ article }: { article: ExecutiveArticle }) {
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

// Simple headline list for Woodside section
function WoodsideHeadline({ article }: { article: ExecutiveArticle }) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-start gap-3 p-3 rounded-lg border border-border bg-card hover:border-primary/30 hover:bg-muted/30 transition-all"
    >
      <div className="flex-shrink-0 mt-0.5">
        <div className="h-8 w-8 rounded-lg bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center">
          <span className="text-amber-600 dark:text-amber-400 text-sm">W</span>
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors line-clamp-2">
          {article.title}
        </p>
        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
          <span>{article.source}</span>
          <span>•</span>
          <span>{new Date(article.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
        </div>
      </div>
    </a>
  );
}

// Section header component
function SectionHeader({ icon, title, subtitle }: { icon: string; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="text-xl">{icon}</span>
      <div>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}

export default async function Dashboard() {
  const [auBriefs, usBriefs, executiveDashboard] = await Promise.all([
    fetchLatest("au"),
    fetchLatest("us-mx-la-lng"),
    getExecutiveDashboardData()
  ]);

  // Combine and sort all briefs by date, then take the 10 latest
  const allBriefs = [...auBriefs, ...usBriefs]
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, 10);

  return (
    <div className="space-y-8">
      {/* Market Indices Ticker */}
      <section className="dashboard-section">
        <div className="rounded-xl border border-border bg-gradient-to-r from-card via-card to-card overflow-hidden">
          <div className="relative py-3">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/[0.02] via-transparent to-primary/[0.02]" />
            <div className="relative">
              <LiveMarketTicker showHeader={true} />
            </div>
          </div>
        </div>
      </section>

      {/* Woodside Energy News */}
      <section className="dashboard-section">
        <SectionHeader 
          icon="🛢️" 
          title="Woodside Energy" 
          subtitle="Latest news from Woodside.com and industry sources"
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {executiveDashboard.woodsideArticles.slice(0, 6).map((article, idx) => (
            <WoodsideHeadline key={`woodside-${idx}`} article={article} />
          ))}
        </div>
      </section>

      {/* APAC Region News */}
      <section className="dashboard-section">
        <SectionHeader 
          icon="🌏" 
          title="APAC Region" 
          subtitle="Australia, Perth, Asia-Pacific energy news"
        />
        <div className="news-grid">
          {executiveDashboard.apacArticles.slice(0, 6).map((article, idx) => (
            <ArticleCard key={`apac-${idx}`} article={article} />
          ))}
        </div>
      </section>

      {/* International Region News */}
      <section className="dashboard-section">
        <SectionHeader 
          icon="🌎" 
          title="International" 
          subtitle="Houston, Mexico, Senegal, Americas energy news"
        />
        <div className="news-grid">
          {executiveDashboard.internationalArticles.slice(0, 6).map((article, idx) => (
            <ArticleCard key={`intl-${idx}`} article={article} />
          ))}
        </div>
      </section>

      {/* Latest Briefs */}
      <section className="dashboard-section">
        <LatestBriefsList briefs={allBriefs} />
      </section>
    </div>
  );
}
