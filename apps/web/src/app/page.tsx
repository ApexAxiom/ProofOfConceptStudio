import Link from "next/link";
import { BriefPost, PORTFOLIOS, portfolioLabel, regionLabel } from "@proof/shared";
import { fetchLatest } from "../lib/api";
import { ExecutiveArticle, getExecutiveDashboardData } from "../lib/executive-dashboard";
import { formatTimestampWithTimezones } from "../lib/format-time";

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
      <p className="mt-1 text-xs text-muted-foreground">
        {article.domain ?? article.source} ·{" "}
        {new Date(article.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
      </p>
      {article.summary ? <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{article.summary}</p> : null}
    </a>
  );
}

function sectionTimestamp(label: string, iso: string) {
  return (
    <span className="text-xs font-mono text-muted-foreground">
      {label}: {formatTimestampWithTimezones(iso)}
    </span>
  );
}

function latestBriefRows(briefs: BriefPost[]): Array<BriefPost | { placeholder: true; portfolio: string; region: string; publishedAt: string }> {
  const sorted = [...briefs].sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  if (sorted.length >= 10) return sorted.slice(0, 10);

  const rows: Array<BriefPost | { placeholder: true; portfolio: string; region: string; publishedAt: string }> = [...sorted];
  const knownPairs = new Set(sorted.map((brief) => `${brief.region}:${brief.portfolio}`));
  const nowIso = new Date().toISOString();

  for (const portfolio of PORTFOLIOS) {
    if (rows.length >= 10) break;
    const fallbackRegion = "us-mx-la-lng";
    const key = `${fallbackRegion}:${portfolio.slug}`;
    if (knownPairs.has(key)) continue;
    rows.push({
      placeholder: true,
      portfolio: portfolio.slug,
      region: fallbackRegion,
      publishedAt: nowIso
    });
  }

  return rows.slice(0, 10);
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

  const marketStatusLabel =
    executiveData.market.source === "live"
      ? "LIVE"
      : executiveData.market.source === "mixed"
        ? "MIXED (LIVE + STALE)"
        : "FALLBACK";

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
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                executiveData.market.source === "live"
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
          {executiveData.market.quotes.map((quote) => (
            <a
              key={`${quote.symbol}:${quote.sourceUrl}`}
              href={quote.sourceUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="rounded-lg border border-border bg-background p-3 transition hover:border-primary/30"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">{quote.symbol}</span>
                <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{quote.state}</span>
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
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Woodside Current News</h2>
            <p className="text-sm text-muted-foreground">Google News RSS search for Woodside Energy.</p>
          </div>
          {sectionTimestamp("Last updated", executiveData.woodside.lastUpdated)}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {woodsideArticles.map((article) => (
            <NewsCard key={article.url} article={article} />
          ))}
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
          {apacArticles.map((article) => (
            <NewsCard key={article.url} article={article} />
          ))}
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
          {internationalArticles.map((article) => (
            <NewsCard key={article.url} article={article} />
          ))}
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
          {topBriefRows.map((row, index) => {
            if ("placeholder" in row) {
              return (
                <div key={`placeholder-${row.portfolio}-${index}`} className="rounded-lg border border-border bg-background p-3">
                  <p className="text-sm font-semibold text-foreground">{portfolioLabel(row.portfolio)} — Baseline pending</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {regionLabel(row.region as "au" | "us-mx-la-lng")} · {new Date(row.publishedAt).toLocaleDateString("en-US")}
                  </p>
                </div>
              );
            }

            return (
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
            );
          })}
        </div>
      </section>
    </div>
  );
}

