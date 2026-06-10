import Link from "next/link";
import { BriefPost, REGION_LIST, portfolioLabel, regionLabel } from "@proof/shared";
import { fetchLatestByPortfolio } from "../lib/api";
import { getExecutiveDashboardData } from "../lib/executive-dashboard";
import { formatDateWithTimezone } from "../lib/format-time";
import { MarketTicker } from "../components/MarketTicker";
import { CategoryDayBoard, CategoryDayRow } from "../components/CategoryDayBoard";
import { NewsTabs } from "../components/NewsTabs";

export const revalidate = 60;

// Procurement-relevant benchmarks only; macro tickers (DXY, SPX) added noise
// without changing any category decision.
const EXECUTIVE_MARKET_SYMBOLS = ["WTI", "BRENT", "NG", "HRC", "IRON", "COPPER", "BDRY", "AUDUSD"];

function toCategoryRow(brief: BriefPost): CategoryDayRow {
  return {
    portfolio: brief.portfolio,
    portfolioLabel: portfolioLabel(brief.portfolio),
    postId: brief.postId,
    title: brief.title,
    publishedAt: brief.publishedAt,
    signalLevel: brief.signalLevel
  };
}

function sortRows(rows: CategoryDayRow[]): CategoryDayRow[] {
  const rank = (row: CategoryDayRow) =>
    row.signalLevel === "act" ? 0 : row.signalLevel === "watch" ? 1 : row.signalLevel === "awareness" ? 2 : 3;
  return [...rows].sort((a, b) => rank(a) - rank(b) || a.portfolioLabel.localeCompare(b.portfolioLabel));
}

/**
 * Today view: per-category triage board, market benchmarks, and one tabbed
 * news block. Built so a category manager can answer "did anything happen in
 * my market that changes what I should do?" in under a minute.
 */
export default async function TodayPage() {
  const [auBriefs, internationalBriefs, executiveData] = await Promise.all([
    fetchLatestByPortfolio("au"),
    fetchLatestByPortfolio("us-mx-la-lng"),
    getExecutiveDashboardData()
  ]);

  const boards = REGION_LIST.map((region) => {
    const briefs = region.slug === "au" ? auBriefs : internationalBriefs;
    return {
      region: region.slug,
      regionLabel: regionLabel(region.slug),
      rows: sortRows(briefs.map(toCategoryRow))
    };
  });

  const newsTabs = [
    {
      id: "woodside",
      label: "Woodside & Operators",
      articles: executiveData.woodside.articles.slice(0, 8)
    },
    {
      id: "apac",
      label: "APAC",
      description: "Regional APAC updates relevant to offshore and LNG procurement.",
      articles: executiveData.apac.articles.slice(0, 8)
    },
    {
      id: "international",
      label: "International",
      description: "Filtered for USA, Mexico, and Senegal relevance.",
      articles: executiveData.international.articles.slice(0, 8)
    }
  ];

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-border bg-card p-6 md:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Today</p>
            <h1 className="mt-2 text-2xl font-semibold text-foreground">Category intelligence triage</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Latest brief per category with its signal level — act, watch, or awareness — plus market benchmarks and
              regional headlines.
            </p>
          </div>
          <div className="flex shrink-0 items-start gap-2 md:pt-1">
            <Link href={`/actions/${REGION_LIST[0].slug}`} className="btn-secondary text-sm">
              Open Action Center
            </Link>
          </div>
        </div>
      </header>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold text-foreground">My categories today</h2>
          <span className="text-xs font-mono text-muted-foreground">
            Refreshed: {formatDateWithTimezone(executiveData.generatedAt)}
          </span>
        </div>
        <div className="mt-4">
          <CategoryDayBoard boards={boards} />
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Market benchmarks</h2>
            <p className="text-sm text-muted-foreground">Procurement-relevant commodities. Click any quote for the source.</p>
          </div>
          <span className="text-xs font-mono text-muted-foreground">
            Last updated: {formatDateWithTimezone(executiveData.market.lastUpdated)}
          </span>
        </div>
        <div className="mt-4">
          <MarketTicker
            showHeader={false}
            symbols={EXECUTIVE_MARKET_SYMBOLS}
            initialData={executiveData.market.quotes}
            initialTimestamp={executiveData.market.lastUpdated}
          />
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold text-foreground">Headlines</h2>
          <span className="text-xs font-mono text-muted-foreground">
            Last updated: {formatDateWithTimezone(executiveData.woodside.lastUpdated)}
          </span>
        </div>
        <div className="mt-4">
          <NewsTabs tabs={newsTabs} />
        </div>
      </section>
    </div>
  );
}
