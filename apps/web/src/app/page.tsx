import { fetchLatest } from "../lib/api";
import { getExecutiveDashboardData, ExecutiveArticle } from "../lib/executive-dashboard";
import Link from "next/link";
import { REGION_LIST } from "@proof/shared";
import { inferSignals } from "../lib/signals";
import { portfolioLabel } from "@proof/shared";
import { cmEvidenceLink } from "../components/cm/cmEvidenceLink";

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

function KpiCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-display font-semibold text-foreground">{value}</p>
      {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
    </div>
  );
}

export default async function Dashboard({
  searchParams
}: {
  searchParams?: Promise<{ q?: string | string[] }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const queryValue = Array.isArray(resolvedSearchParams?.q)
    ? resolvedSearchParams?.q[0]
    : resolvedSearchParams?.q;
  const query = (queryValue ?? "").toLowerCase().trim();
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

  const filteredBriefs = query
    ? allBriefs.filter((brief) => {
        const signals = inferSignals(brief).map((signal) => signal.label.toLowerCase()).join(" ");
        return (
          brief.title.toLowerCase().includes(query) ||
          portfolioLabel(brief.portfolio).toLowerCase().includes(query) ||
          signals.includes(query) ||
          (brief.tags || []).some((tag) => tag.toLowerCase().includes(query))
        );
      })
    : allBriefs;

  const topBriefs = filteredBriefs.slice(0, 5);

  const signalCounts = filteredBriefs.reduce(
    (acc, brief) => {
      inferSignals(brief).forEach((signal) => {
        acc[signal.type] += 1;
      });
      return acc;
    },
    { cost: 0, "supply-risk": 0, regulatory: 0, cyber: 0, commercial: 0 }
  );

  const today = new Date();
  const briefsUpdatedToday = filteredBriefs.filter((brief) => {
    const published = new Date(brief.publishedAt);
    return published.toDateString() === today.toDateString();
  });

  const apacBriefsToday = briefsUpdatedToday.filter((brief) => brief.region === "au").length;
  const intlBriefsToday = briefsUpdatedToday.filter((brief) => brief.region !== "au").length;

  const actions = filteredBriefs
    .flatMap((brief) =>
      brief.vpSnapshot?.recommendedActions?.map((action) => ({
        portfolio: brief.portfolio,
        postId: brief.postId,
        title: brief.title,
        action: action.action,
        ownerRole: action.ownerRole,
        dueInDays: action.dueInDays,
        publishedAt: brief.publishedAt,
        href: cmEvidenceLink(brief, action.evidenceArticleIndex)
      })) ?? []
    )
    .sort((a, b) => a.dueInDays - b.dueInDays)
    .slice(0, 5);

  return (
    <div className="space-y-10">
      {/* Today at a glance */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Executive Scan</p>
            <h1 className="text-2xl font-display font-semibold text-foreground">Today at a glance</h1>
          </div>
          <span className="text-xs text-muted-foreground">
            {query ? `Filtered by “${queryValue}”` : `${totalArticles}+ sources monitored`}
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <KpiCard label="Cost signals" value={`${signalCounts.cost}`} detail="Briefs tagged for cost movement" />
          <KpiCard label="Supply risk" value={`${signalCounts["supply-risk"]}`} detail="Outages, capacity, disruption" />
          <KpiCard label="Regulatory + Cyber" value={`${signalCounts.regulatory + signalCounts.cyber}`} detail="Policy + security drivers" />
          <KpiCard label="Briefs updated" value={`${briefsUpdatedToday.length}`} detail={`APAC ${apacBriefsToday} • INTL ${intlBriefsToday}`} />
          <KpiCard label="Actions due" value={`${actions.length}`} detail="Next 7/14/30 day focus" />
        </div>
      </section>

      {/* Top briefs */}
      <section className="space-y-4">
        <SectionHeader
          icon="🧭"
          title="Top 5 briefs you should read"
          subtitle="Ranked by recency and signal strength"
          action={
            <Link href="/au" className="btn-ghost text-xs">
              Browse regions {"->"}
            </Link>
          }
        />
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/20">
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Category</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Headline</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Key Data</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Signal</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Region</th>
                <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Open</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {topBriefs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-muted-foreground">
                    No briefs match your filters.
                  </td>
                </tr>
              ) : (
                topBriefs.map((brief) => {
                  const signals = inferSignals(brief);
                  const keyMetric = brief.selectedArticles?.[0]?.keyMetrics?.[0];
                  return (
                    <tr key={brief.postId} className="hover:bg-secondary/10">
                      <td className="px-4 py-3 text-xs text-muted-foreground">{portfolioLabel(brief.portfolio)}</td>
                      <td className="px-4 py-3">
                        <Link href={`/brief/${brief.postId}`} className="text-sm font-medium text-foreground hover:text-primary line-clamp-1">
                          {brief.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        {keyMetric ? (
                          <span className="inline-flex items-center rounded-md bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-semibold text-primary">
                            {keyMetric}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {signals.length > 0 ? (
                          <span className="signal-chip text-[10px]">{signals[0].label}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs">{brief.region === "au" ? "APAC" : "INTL"}</td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/brief/${brief.postId}`} className="text-xs font-semibold text-primary hover:text-primary/80">
                          Open
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Top actions */}
      <section className="space-y-4">
        <SectionHeader
          icon="✅"
          title="Top 5 opportunities"
          subtitle="Cross-portfolio priorities to execute"
          action={
            <Link href={`/actions/${REGION_LIST[0].slug}`} className="btn-ghost text-xs">
              Open Action Center {"->"}
            </Link>
          }
        />
        <div className="rounded-xl border border-border bg-card p-4">
          {actions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No leadership actions available for the current filter.</p>
          ) : (
            <ul className="space-y-3">
              {actions.map((entry) => (
                <li key={`${entry.postId}-${entry.action}`} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-secondary/20 px-4 py-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="rounded-full bg-muted px-2 py-0.5 font-semibold text-foreground">{entry.ownerRole}</span>
                      <span>{portfolioLabel(entry.portfolio)}</span>
                      <span className="text-border">•</span>
                      <span>{new Date(entry.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                    </div>
                    <p className="text-sm font-medium text-foreground">{entry.action}</p>
                  </div>
                  <Link href={entry.href} className="text-xs font-semibold text-primary hover:text-primary/80">
                    Brief
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Latest News */}
      <section className="dashboard-section">
        <div className="rounded-xl border border-border bg-card">
          <div className="px-5 py-4 text-sm font-semibold text-foreground">
            <span>Latest News ({totalArticles} items)</span>
          </div>
          <div className="space-y-8 px-5 pb-5 pt-2">
            <div>
              <SectionHeader
                icon="🛢️"
                title="Woodside Energy"
                subtitle="Latest news from Woodside.com and industry sources"
              />
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {executiveDashboard.woodsideArticles.slice(0, 6).map((article, idx) => (
                  <WoodsideHeadline key={`woodside-${idx}`} article={article} index={idx} />
                ))}
              </div>
            </div>
            <div>
              <SectionHeader
                icon="🌏"
                title="APAC Region"
                subtitle="Australia, Perth, Asia-Pacific energy & procurement news"
              />
              <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {executiveDashboard.apacArticles.slice(0, 1).map((article, idx) => (
                  <ArticleCard key={`apac-featured-${idx}`} article={article} featured={true} />
                ))}
                {executiveDashboard.apacArticles.slice(1, 5).map((article, idx) => (
                  <ArticleCard key={`apac-${idx}`} article={article} />
                ))}
              </div>
            </div>
            <div>
              <SectionHeader
                icon="🌎"
                title="International"
                subtitle="Houston, Mexico, Senegal, Americas energy & procurement news"
              />
              <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {executiveDashboard.internationalArticles.slice(0, 1).map((article, idx) => (
                  <ArticleCard key={`intl-featured-${idx}`} article={article} featured={true} />
                ))}
                {executiveDashboard.internationalArticles.slice(1, 5).map((article, idx) => (
                  <ArticleCard key={`intl-${idx}`} article={article} />
                ))}
              </div>
            </div>
          </div>
        </div>
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
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-400">
              AI conversation currently in development.
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
