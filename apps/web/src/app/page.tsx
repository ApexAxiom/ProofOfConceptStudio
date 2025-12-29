import { BriefsTable } from "../components/BriefsTable";
import { CoverageMatrix } from "../components/CoverageMatrix";
import { LiveMarketTicker } from "../components/LiveMarketTicker";
import { REGIONS, BriefPost, RegionSlug } from "@proof/shared";
import { fetchLatest, fetchLatestByPortfolio } from "../lib/api";
import { getExecutiveDashboardData, ExecutiveArticle } from "../lib/executive-dashboard";

// Headline card with optional image
function HeadlineCard({ article }: { article: ExecutiveArticle }) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block rounded-lg border border-border bg-card overflow-hidden hover:border-primary/40 hover:shadow-sm transition-all"
    >
      {article.imageUrl && (
        <div className="aspect-video bg-muted overflow-hidden">
          <img 
            src={article.imageUrl} 
            alt={article.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </div>
      )}
      <div className="p-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
          <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-medium uppercase">
            {article.category}
          </span>
          <span>{article.source}</span>
          <span>•</span>
          <span>{new Date(article.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
        </div>
        <p className="text-sm font-medium text-foreground line-clamp-2 leading-snug">{article.title}</p>
        {article.summary && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{article.summary}</p>
        )}
      </div>
    </a>
  );
}

// Region headlines section
function HeadlinesSection({ 
  title, 
  subtitle,
  articles, 
  flag 
}: { 
  title: string; 
  subtitle: string;
  articles: ExecutiveArticle[]; 
  flag: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-lg">{flag}</span>
        <div>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {articles.map((article) => (
          <HeadlineCard key={`${article.source}-${article.title}`} article={article} />
        ))}
      </div>
    </div>
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
      {/* Market Indices - Animated Ticker Strip */}
      <div className="relative rounded-xl border border-border bg-gradient-to-r from-card via-card to-card overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/[0.02] via-transparent to-primary/[0.02]" />
        <div className="relative py-3">
          <LiveMarketTicker showHeader={true} />
        </div>
      </div>

      {/* Industry Headlines - APAC */}
      <HeadlinesSection
        title="Industry Headlines APAC"
        subtitle="Australia, Perth, Asia-Pacific oil & gas and LNG news"
        articles={executiveDashboard.apacArticles}
        flag="🌏"
      />

      {/* Industry Headlines - International */}
      <HeadlinesSection
        title="Industry Headlines International"
        subtitle="Houston, Mexico, Senegal, Americas oil & gas and LNG news"
        articles={executiveDashboard.internationalArticles}
        flag="🌎"
      />

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
