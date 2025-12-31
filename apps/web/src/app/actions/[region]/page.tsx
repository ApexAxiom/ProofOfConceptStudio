import Link from "next/link";
import {
  REGION_LIST,
  RegionSlug,
  regionLabel,
  portfolioLabel,
  PORTFOLIOS
} from "@proof/shared";
import { fetchLatestByPortfolio } from "../../../lib/api";

interface ActionEntry {
  portfolio: string;
  postId: string;
  title: string;
  items: string[];
}

function byPortfolioOrder(a: ActionEntry, b: ActionEntry) {
  const order = PORTFOLIOS.findIndex((p) => p.slug === a.portfolio) - PORTFOLIOS.findIndex((p) => p.slug === b.portfolio);
  return order === 0 ? a.title.localeCompare(b.title) : order;
}

export default async function ActionCenter({
  params,
  searchParams
}: {
  params: Promise<{ region: string }>;
  searchParams?: Promise<{ q?: string | string[] }>;
}) {
  const { region } = await params;
  const selectedRegion = REGION_LIST.find((r) => r.slug === region);
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const queryValue = Array.isArray(resolvedSearchParams?.q)
    ? resolvedSearchParams.q[0]
    : resolvedSearchParams?.q;
  const query = (queryValue ?? "").toLowerCase().trim();

  if (!selectedRegion) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-foreground">Region not found</h1>
        <p className="text-muted-foreground">Unknown region: {region}</p>
        <Link href="/" className="btn-secondary text-sm">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const briefs = await fetchLatestByPortfolio(selectedRegion.slug as RegionSlug);

  const procurement = briefs
    .map<ActionEntry | null>((brief) =>
      brief.procurementActions?.length
        ? {
            portfolio: brief.portfolio,
            postId: brief.postId,
            title: brief.title,
            items: brief.procurementActions
          }
        : null
    )
    .filter((entry): entry is ActionEntry => Boolean(entry))
    .sort(byPortfolioOrder);

  const watchlist = briefs
    .map<ActionEntry | null>((brief) =>
      brief.watchlist?.length
        ? {
            portfolio: brief.portfolio,
            postId: brief.postId,
            title: brief.title,
            items: brief.watchlist
          }
        : null
    )
    .filter((entry): entry is ActionEntry => Boolean(entry))
    .sort(byPortfolioOrder);

  const filterEntries = (entries: ActionEntry[]) =>
    query
      ? entries.filter((entry) => {
          const hay = `${portfolioLabel(entry.portfolio)} ${entry.title} ${entry.items.join(" ")}`.toLowerCase();
          return hay.includes(query);
        })
      : entries;

  const filteredProcurement = filterEntries(procurement);
  const filteredWatchlist = filterEntries(watchlist);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Action Center</p>
          <h1 className="text-xl font-semibold text-foreground sm:text-2xl">
            {regionLabel(selectedRegion.slug)}
          </h1>
          <p className="text-sm text-muted-foreground">
            Daily procurement actions and watchlist items aggregated across all portfolios.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/" className="btn-secondary text-sm">
            Dashboard
          </Link>
          <Link href={`/portfolio/${PORTFOLIOS[0].slug}`} className="btn-tertiary text-sm">
            Browse portfolios
          </Link>
        </div>
      </div>

      <form className="flex flex-col gap-2 sm:flex-row" role="search">
        <input
          type="search"
          name="q"
          placeholder="Search actions or watchlist"
          defaultValue={resolvedSearchParams?.q ?? ""}
          className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
        />
        <button type="submit" className="btn-primary text-sm">
          Search
        </button>
      </form>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Procurement Actions</p>
              <h2 className="text-lg font-semibold text-foreground">Across portfolios</h2>
            </div>
            <span className="text-xs text-muted-foreground">{filteredProcurement.length} portfolios</span>
          </div>
          <div className="space-y-3">
            {filteredProcurement.length === 0 && (
              <p className="text-sm text-muted-foreground">No procurement actions found.</p>
            )}
            {filteredProcurement.map((entry) => (
              <div key={`${entry.portfolio}-${entry.postId}`} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{portfolioLabel(entry.portfolio)}</p>
                    <h3 className="text-sm font-semibold text-foreground line-clamp-2">{entry.title}</h3>
                  </div>
                  <Link href={`/brief/${entry.postId}`} className="text-xs font-medium text-primary hover:underline">
                    View brief
                  </Link>
                </div>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-foreground">
                  {entry.items.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Watchlist</p>
              <h2 className="text-lg font-semibold text-foreground">Signals to monitor</h2>
            </div>
            <span className="text-xs text-muted-foreground">{filteredWatchlist.length} portfolios</span>
          </div>
          <div className="space-y-3">
            {filteredWatchlist.length === 0 && (
              <p className="text-sm text-muted-foreground">No watchlist items found.</p>
            )}
            {filteredWatchlist.map((entry) => (
              <div key={`${entry.portfolio}-${entry.postId}`} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{portfolioLabel(entry.portfolio)}</p>
                    <h3 className="text-sm font-semibold text-foreground line-clamp-2">{entry.title}</h3>
                  </div>
                  <Link href={`/brief/${entry.postId}`} className="text-xs font-medium text-primary hover:underline">
                    View brief
                  </Link>
                </div>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-foreground">
                  {entry.items.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
