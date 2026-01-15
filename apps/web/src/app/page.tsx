import { LatestBriefsList } from "../components/LatestBriefsList";
import { LiveMarketTicker } from "../components/LiveMarketTicker";
import { fetchLatest } from "../lib/api";
import { getExecutiveDashboardData, ExecutiveArticle } from "../lib/executive-dashboard";
import Link from "next/link";
import { PORTFOLIOS } from "@proof/shared";

// Premium article card with editorial styling
function ArticleCard({ article, featured = false }: { article: ExecutiveArticle; featured?: boolean }) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`group relative block overflow-hidden rounded-lg border border-border bg-card transition-all duration-300 hover:border-primary/40 ${
        featured ? "lg:col-span-2 lg:row-span-2" : ""
      }`}
      style={{
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.12)"
      }}
    >
      {article.imageUrl && (
        <div className={`relative overflow-hidden bg-secondary ${featured ? "aspect-[16/9]" : "aspect-[16/10]"}`}>
          <img 
            src={article.imageUrl} 
            alt={article.title}
            className="h-full w-full object-cover transition-all duration-500 group-hover:scale-105"
            style={{ filter: "brightness(0.9)" }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          
          {/* Category badge on image */}
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/90 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground">
                {article.category}
              </span>
              <span className="text-xs text-white/80">{article.source}</span>
            </div>
            <h3 className={`font-display font-semibold text-white leading-snug ${featured ? "text-xl lg:text-2xl" : "text-sm"} line-clamp-2`}>
              {article.title}
            </h3>
          </div>
        </div>
      )}
      
      {!article.imageUrl && (
        <div className="p-4">
          <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
            <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-semibold uppercase tracking-wider text-[10px]">
              {article.category}
            </span>
            <span>{article.source}</span>
            <span className="text-border">•</span>
            <span>{new Date(article.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
          </div>
          <h3 className="font-display text-base font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors">
            {article.title}
          </h3>
          {article.summary && (
            <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{article.summary}</p>
          )}
        </div>
      )}
    </a>
  );
}

// Woodside headline with premium styling
function WoodsideHeadline({ article, index }: { article: ExecutiveArticle; index: number }) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-start gap-4 p-4 rounded-lg border border-border bg-card hover:border-primary/30 hover:bg-secondary/30 transition-all duration-300 reveal-up"
      style={{ animationDelay: `${index * 0.1}s` }}
    >
      <div className="flex-shrink-0">
        <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center">
          <span className="font-display font-bold text-primary text-sm">W</span>
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-display text-sm font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-snug">
          {article.title}
        </p>
        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
          <span className="font-medium">{article.source}</span>
          <span className="text-border">•</span>
          <span>{new Date(article.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
        </div>
      </div>
      <svg className="h-4 w-4 text-muted-foreground group-hover:text-primary flex-shrink-0 mt-1 transition-all group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
      </svg>
    </a>
  );
}

// Section header with editorial styling
function SectionHeader({ icon, title, subtitle, action }: { icon: string; title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between mb-5">
      <div className="flex items-start gap-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <h2 className="font-display text-xl font-bold text-foreground tracking-tight">{title}</h2>
          {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

// Stat card for hero section
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

  const totalArticles = executiveDashboard.apacArticles.length + 
    executiveDashboard.internationalArticles.length + 
    executiveDashboard.woodsideArticles.length;

  const executiveKpis = [
    { label: "Headlines tracked", value: totalArticles.toLocaleString(), detail: "Across priority feeds" },
    { label: "Market indices", value: executiveDashboard.indices.length.toString(), detail: "Live / estimated" },
    { label: "Briefs staged", value: allBriefs.length.toString(), detail: "Latest run windows" },
    { label: "Category coverage", value: PORTFOLIOS.length.toString(), detail: "Active portfolios" },
  ];

  return (
    <div className="space-y-10">
      {/* Hero Section - Editorial masthead */}
      <section className="relative -mx-6 -mt-6 px-6 pt-6 pb-8 lg:-mx-8 lg:px-8 border-b border-border bg-gradient-to-b from-secondary/30 to-transparent">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-start">
          <div className="max-w-3xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="accent-line" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">Category Intelligence</span>
            </div>
            <h1 className="hero-title text-foreground mb-4">
              Your Daily Market<br />
              <span className="text-gradient-gold">Intelligence Brief</span>
            </h1>
            <p className="hero-subtitle">
              AI-curated procurement insights across energy, steel, freight, and services.
              Updated in real-time from {totalArticles}+ verified sources.
            </p>
            <p className="mt-3 text-sm font-semibold text-amber-500">
              Data status: Live / Estimated (fallbacks are explicitly labeled).
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card px-5 py-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="accent-line" />
                <h2 className="font-display text-sm font-semibold text-foreground">Executive KPIs</h2>
              </div>
              <div className="text-xs text-muted-foreground">Snapshot for leadership review</div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {executiveKpis.map((kpi) => (
                <div key={kpi.label} className="rounded-lg border border-border bg-secondary/30 px-4 py-3">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    {kpi.label}
                  </div>
                  <div className="mt-2 text-2xl font-display font-semibold text-foreground">{kpi.value}</div>
                  <div className="text-xs text-muted-foreground mt-1">{kpi.detail}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Market Indices Ticker - Premium styling */}
      <section className="dashboard-section">
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="relative">
            {/* Subtle gradient background */}
            <div className="absolute inset-0 bg-gradient-to-r from-primary/[0.02] via-transparent to-primary/[0.02]" />
            <div className="relative py-2">
              <LiveMarketTicker showHeader={true} />
            </div>
          </div>
        </div>
      </section>

      {/* Woodside Energy News - Featured section */}
      <section className="dashboard-section">
        <SectionHeader 
          icon="🛢️" 
          title="Woodside Energy" 
          subtitle="Latest news from Woodside.com and industry sources"
          action={
            <Link href="/category/energy" className="btn-outline-gold text-xs py-1.5">
              View All Energy ->
            </Link>
          }
        />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {executiveDashboard.woodsideArticles.slice(0, 6).map((article, idx) => (
            <WoodsideHeadline key={`woodside-${idx}`} article={article} index={idx} />
          ))}
        </div>
      </section>

      {/* Editorial divider */}
      <div className="section-divider">
        <h2>Regional Intelligence</h2>
      </div>

      {/* APAC Region News - Editorial grid */}
      <section className="dashboard-section">
        <SectionHeader 
          icon="🌏" 
          title="APAC Region" 
          subtitle="Australia, Perth, Asia-Pacific energy & procurement news"
          action={
            <Link href="/au" className="btn-ghost text-xs">
              View Region ->
            </Link>
          }
        />
        <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {executiveDashboard.apacArticles.slice(0, 1).map((article, idx) => (
            <ArticleCard key={`apac-featured-${idx}`} article={article} featured={true} />
          ))}
          {executiveDashboard.apacArticles.slice(1, 5).map((article, idx) => (
            <ArticleCard key={`apac-${idx}`} article={article} />
          ))}
        </div>
      </section>

      {/* International Region News */}
      <section className="dashboard-section">
        <SectionHeader 
          icon="🌎" 
          title="International" 
          subtitle="Houston, Mexico, Senegal, Americas energy & procurement news"
          action={
            <Link href="/us-mx-la-lng" className="btn-ghost text-xs">
              View Region ->
            </Link>
          }
        />
        <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {executiveDashboard.internationalArticles.slice(0, 1).map((article, idx) => (
            <ArticleCard key={`intl-featured-${idx}`} article={article} featured={true} />
          ))}
          {executiveDashboard.internationalArticles.slice(1, 5).map((article, idx) => (
            <ArticleCard key={`intl-${idx}`} article={article} />
          ))}
        </div>
      </section>

      {/* Editorial divider */}
      <div className="section-divider">
        <h2>Intelligence Briefs</h2>
      </div>

      {/* Latest Briefs - Premium styling */}
      <section className="dashboard-section">
        <LatestBriefsList briefs={allBriefs} />
      </section>

      {/* CTA Section */}
      <section className="relative overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-br from-secondary via-card to-secondary p-6 lg:p-8">
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary/5 rounded-full blur-3xl" />
        
        <div className="relative flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div>
            <h3 className="font-display text-2xl font-bold text-foreground mb-2">Need deeper insights?</h3>
            <p className="text-muted-foreground max-w-lg">
              Ask our AI assistant about any category, market trend, or procurement strategy. 
              Get instant analysis powered by your intelligence data.
            </p>
          </div>
          <Link href="/chat" className="btn-primary text-sm flex-shrink-0">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            Start AI Conversation
          </Link>
        </div>
      </section>
    </div>
  );
}


