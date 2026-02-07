import Link from "next/link";
import { BriefPost, portfolioLabel, regionLabel } from "@proof/shared";
import { fetchLatest } from "../lib/api";
import { ExecutiveArticle, getExecutiveDashboardData } from "../lib/executive-dashboard";
import { formatDateWithTimezone } from "../lib/format-time";

export const dynamic = "force-dynamic";

function formatPrice(price: number): string {
  if (price >= 1000) return price.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (price < 1) return price.toFixed(4);
  return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatChange(changePercent: number): string {
  return `${changePercent >= 0 ? "+" : ""}${changePercent.toFixed(2)}%`;
}

function isArticleDuplicate(article: ExecutiveArticle, seen: Set<string>): boolean {
  const key = article.url.toLowerCase();
  if (seen.has(key)) return true;
  seen.add(key);
  return false;
}

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

  const seenArticleUrls = new Set<string>();
  const woodsideArticles = executiveData.woodside.articles.filter((article) => !isArticleDuplicate(article, seenArticleUrls)).slice(0, 6);
  const apacArticles = executiveData.apac.articles.filter((article) => !isArticleDuplicate(article, seenArticleUrls)).slice(0, 6);
  const internationalArticles = executiveData.international.articles
    .filter((article) => !isArticleDuplicate(article, seenArticleUrls))
    .slice(0, 6);

  const chicagoNow = new Date();
  const chicagoHour = Number(
    chicagoNow.toLocaleString("en-US", { timeZone: "America/Chicago", hour: "2-digit", hour12: false })
  );
  const chicagoWeekday = chicagoNow.toLocaleString("en-US", { timeZone: "America/Chicago", weekday: "short" });
  const isWeekend = chicagoWeekday === "Sat" || chicagoWeekday === "Sun";
  const marketClosed = isWeekend || chicagoHour < 9 || chicagoHour >= 16;
  const marketCloseLabel = new Date(executiveData.market.lastUpdated).toLocaleDateString("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    year: "numeric"
  });
  const marketStatusLabel = marketClosed
    ? `CLOSED ${marketCloseLabel}`
    : executiveData.market.source === "live"
      ? "LIVE"
      : executiveData.market.source === "mixed"
        ? "UPDATING"
        : "CHECKING";

  return (
    <div className="space-y-8">
      <header className="rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Executive View</p>
            <h1 className="mt-2 text-2xl font-semibold text-foreground">Market and category intelligence cockpit</h1>
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
            <p className="mt-1 text-xs text-muted-foreground">Snapshots: 9:00 AM · 12:00 PM · Close (4:00 PM) CST</p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                marketClosed
                  ? "text-slate-600 dark:text-slate-300 bg-slate-500/10"
                  : executiveData.market.source === "live"
                    ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
                    : executiveData.market.source === "mixed"
                      ? "text-amber-600 dark:text-amber-400 bg-amber-500/10"
                      : "text-rose-600 dark:text-rose-400 bg-rose-500/10"
              }`}
            >
              {marketStatusLabel}
            </span>
            {sectionTimestamp("Last updated", executiveData.market.lastUpdated)}
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {executiveData.market.quotes.length > 0 ? (
            executiveData.market.quotes.map((quote) => (
              <a
                key={`${quote.symbol}:${quote.sourceUrl}`}
                href={quote.sourceUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="rounded-lg border border-border bg-background p-3 transition hover:border-primary/30"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">{quote.symbol}</span>
                  <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    {marketClosed ? "Close" : quote.state === "live" ? "Live" : "Delayed"}
                  </span>
                </div>
                <p className="mt-2 text-lg font-mono text-foreground">
                  {quote.unit.startsWith("/") ? "" : "$"}
                  {formatPrice(quote.price)}
                  {quote.unit ? <span className="ml-1 text-xs text-muted-foreground">{quote.unit}</span> : null}
                </p>
                <p className={`text-xs font-mono ${quote.changePercent >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                  {formatChange(quote.changePercent)}
                </p>
              </a>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No market quotes available right now.</p>
          )}
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
              href={`/brief/${row.postId}`}
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
