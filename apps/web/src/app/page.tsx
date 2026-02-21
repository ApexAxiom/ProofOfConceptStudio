import Link from "next/link";
import { BriefPost, portfolioLabel, regionLabel } from "@proof/shared";
import { fetchLatest } from "../lib/api";
import { ExecutiveArticle, getExecutiveDashboardData } from "../lib/executive-dashboard";
import { formatDateWithTimezone } from "../lib/format-time";
import { LiveMarketTicker } from "../components/LiveMarketTicker";

export const dynamic = "force-dynamic";

const EXECUTIVE_MARKET_SYMBOLS = ["WTI", "BRENT", "NG", "HRC", "COPPER", "IRON", "BDRY", "AUDUSD", "DXY", "SPX"];

function NewsCard({ article }: { article: ExecutiveArticle }) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noreferrer noopener"
      className="rounded-lg border border-border bg-background p-4 transition hover:border-primary/40"
    >
      <p className="text-sm font-semibold text-foreground line-clamp-2">{article.title}</p>
    </a>
  );
}

function sectionTimestamp(label: string, iso: string) {
  return (
    <span className="text-xs font-mono text-muted-foreground">
      {label}: {formatDateWithTimezone(iso)}
    </span>
  );
}

function latestBriefRows(briefs: BriefPost[]): BriefPost[] {
  const sorted = [...briefs].sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  return sorted.slice(0, 10);
}

/**
 * Executive View landing page.
 */
export default async function ExecutiveViewPage() {
  const [auBriefs, internationalBriefs, executiveData] = await Promise.all([
    fetchLatest("au"),
    fetchLatest("us-mx-la-lng"),
    getExecutiveDashboardData()
  ]);

  const allBriefs = [...auBriefs, ...internationalBriefs];
  const topBriefRows = latestBriefRows(allBriefs);

  // Dedupe is already handled inside the executive dashboard builder.
  // Avoid cross-section dedupe here so Woodside doesn't starve APAC/International.
  const woodsideArticles = executiveData.woodside.articles.slice(0, 6);
  const apacArticles = executiveData.apac.articles.slice(0, 6);
  const internationalArticles = executiveData.international.articles.slice(0, 6);

  return (
    <div className="space-y-8">
      <header className="rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Executive View</p>
            <h1 className="mt-2 text-2xl font-semibold text-foreground">Market and category intelligence dashboard</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Immediate view of market moves, Woodside signal flow, regional Oil & Gas coverage, and the latest category briefs.
            </p>
          </div>
          <Link href="/morning-scan" className="btn-secondary text-sm">
            Open Morning Scan
          </Link>
        </div>
      </header>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Market Indices</h2>
            <p className="text-sm text-muted-foreground">Procurement-relevant commodities and macro benchmarks.</p>
            <p className="mt-1 text-xs text-muted-foreground">Refreshes hourly (cached). Click any quote for the source.</p>
          </div>
          {sectionTimestamp("Last updated", executiveData.market.lastUpdated)}
        </div>

        <div className="mt-4">
          <LiveMarketTicker showHeader={false} symbols={EXECUTIVE_MARKET_SYMBOLS} />
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Woodside News</h2>
          </div>
          {sectionTimestamp("Last updated", executiveData.woodside.lastUpdated)}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {woodsideArticles.length > 0 ? woodsideArticles.map((article) => <NewsCard key={article.url} article={article} />) : (
            <p className="text-sm text-muted-foreground">No stories available from configured Woodside sources right now.</p>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Top Oil & Gas News in APAC</h2>
            <p className="text-sm text-muted-foreground">Regional APAC updates relevant to offshore and LNG procurement.</p>
          </div>
          {sectionTimestamp("Last updated", executiveData.apac.lastUpdated)}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {apacArticles.length > 0 ? apacArticles.map((article) => <NewsCard key={article.url} article={article} />) : (
            <p className="text-sm text-muted-foreground">No stories available from APAC feeds right now.</p>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Top Oil & Gas News in International</h2>
            <p className="text-sm text-muted-foreground">Filtered for USA, Mexico, and Senegal relevance.</p>
          </div>
          {sectionTimestamp("Last updated", executiveData.international.lastUpdated)}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {internationalArticles.length > 0 ? internationalArticles.map((article) => <NewsCard key={article.url} article={article} />) : (
            <p className="text-sm text-muted-foreground">No stories available from international feeds right now.</p>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Top 10 Latest Briefs</h2>
            <p className="text-sm text-muted-foreground">Across all portfolios and both regions.</p>
          </div>
          {sectionTimestamp("Last refreshed", executiveData.generatedAt)}
        </div>

        <div className="mt-4 space-y-2">
          {topBriefRows.map((row) => (
            <Link
              key={row.postId}
              href={`/brief/${encodeURIComponent(row.postId)}`}
              className="block rounded-lg border border-border bg-background p-3 transition hover:border-primary/40"
            >
              <p className="text-sm font-semibold text-foreground line-clamp-1">{row.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {portfolioLabel(row.portfolio)} · {regionLabel(row.region)} ·{" "}
                {new Date(row.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </p>
            </Link>
          ))}
          {topBriefRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No briefs yet. Briefs appear after the next successful category run.</p>
          ) : null}
          {topBriefRows.length > 0 && topBriefRows.length < 10 ? (
            <p className="text-xs text-muted-foreground">Showing {topBriefRows.length} brief{topBriefRows.length === 1 ? "" : "s"} while additional runs publish.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
