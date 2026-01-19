import Link from "next/link";
import {
  REGION_LIST,
  RegionSlug,
  regionLabel,
  portfolioLabel,
  PORTFOLIOS
} from "@proof/shared";
import { fetchLatestByPortfolio } from "../../../lib/api";
import { inferSignals } from "../../../lib/signals";

interface ActionEntry {
  portfolio: string;
  postId: string;
  title: string;
  items: string[];
  signal: string;
}

interface VpActionEntry {
  portfolio: string;
  postId: string;
  title: string;
  actions: Array<{ action: string; ownerRole: string; dueInDays: number; signal: string }>;
}

interface PortfolioEntry {
  portfolio: string;
  title: string;
}

function byPortfolioOrder(a: PortfolioEntry, b: PortfolioEntry) {
  const order = PORTFOLIOS.findIndex((p) => p.slug === a.portfolio) - PORTFOLIOS.findIndex((p) => p.slug === b.portfolio);
  return order === 0 ? a.title.localeCompare(b.title) : order;
}

export default async function ActionCenter({
  params,
  searchParams
}: {
  params: Promise<{ region: string }>;
  searchParams?: Promise<{
    q?: string | string[];
    tab?: string;
    portfolio?: string;
    owner?: string;
    signal?: string;
    due?: string;
  }>;
}) {
  const { region } = await params;
  const selectedRegion = REGION_LIST.find((r) => r.slug === region);
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const queryValue = Array.isArray(resolvedSearchParams?.q)
    ? resolvedSearchParams.q[0]
    : resolvedSearchParams?.q;
  const query = (queryValue ?? "").toLowerCase().trim();
  const tabParam = resolvedSearchParams?.tab;
  const activeTab = tabParam === "watchlist" ? "watchlist" : tabParam === "leadership" ? "leadership" : "actions";
  const selectedPortfolio = resolvedSearchParams?.portfolio ?? "all";
  const selectedOwner = resolvedSearchParams?.owner ?? "all";
  const selectedSignal = resolvedSearchParams?.signal ?? "all";
  const selectedDue = resolvedSearchParams?.due ?? "all";

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
            items: brief.procurementActions,
            signal: inferSignals(brief)[0]?.label ?? "—"
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
            items: brief.watchlist,
            signal: inferSignals(brief)[0]?.label ?? "—"
          }
        : null
    )
    .filter((entry): entry is ActionEntry => Boolean(entry))
    .sort(byPortfolioOrder);

  const vpActions = briefs
    .map<VpActionEntry | null>((brief) =>
      brief.vpSnapshot?.recommendedActions?.length
        ? {
            portfolio: brief.portfolio,
            postId: brief.postId,
            title: brief.title,
            actions: brief.vpSnapshot.recommendedActions.map((action) => ({
              action: action.action,
              ownerRole: action.ownerRole,
              dueInDays: action.dueInDays,
              signal: inferSignals(brief)[0]?.label ?? "—"
            }))
          }
        : null
    )
    .filter((entry): entry is VpActionEntry => Boolean(entry))
    .sort((a, b) => {
      const base = byPortfolioOrder(a, b);
      if (base !== 0) return base;
      return a.title.localeCompare(b.title);
    });

  const matchesQuery = (text: string) => (query ? text.toLowerCase().includes(query) : true);

  const filteredProcurement = procurement.filter((entry) => {
    if (selectedPortfolio !== "all" && entry.portfolio !== selectedPortfolio) return false;
    if (selectedSignal !== "all" && entry.signal.toLowerCase() !== selectedSignal) return false;
    return matchesQuery(`${portfolioLabel(entry.portfolio)} ${entry.title} ${entry.items.join(" ")}`);
  });

  const filteredWatchlist = watchlist.filter((entry) => {
    if (selectedPortfolio !== "all" && entry.portfolio !== selectedPortfolio) return false;
    if (selectedSignal !== "all" && entry.signal.toLowerCase() !== selectedSignal) return false;
    return matchesQuery(`${portfolioLabel(entry.portfolio)} ${entry.title} ${entry.items.join(" ")}`);
  });

  const flattenedVpActions = vpActions.flatMap((entry) =>
    entry.actions.map((action) => ({
      portfolio: entry.portfolio,
      postId: entry.postId,
      title: entry.title,
      ...action
    }))
  );

  const filteredVpActions = flattenedVpActions.filter((entry) => {
    if (selectedPortfolio !== "all" && entry.portfolio !== selectedPortfolio) return false;
    if (selectedOwner !== "all" && entry.ownerRole !== selectedOwner) return false;
    if (selectedSignal !== "all" && entry.signal.toLowerCase() !== selectedSignal) return false;
    if (selectedDue !== "all" && entry.dueInDays > Number(selectedDue)) return false;
    return matchesQuery(`${portfolioLabel(entry.portfolio)} ${entry.title} ${entry.action} ${entry.ownerRole}`);
  });

  const leadershipThemes = filteredVpActions.reduce<Record<string, typeof filteredVpActions>>((acc, entry) => {
    const key = entry.signal === "—" ? "Other" : entry.signal;
    acc[key] = acc[key] ?? [];
    acc[key].push(entry);
    return acc;
  }, {});

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

      <form className="grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-5" role="search">
        <input type="hidden" name="tab" value={activeTab} />
        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
          <label htmlFor="portfolio">Portfolio</label>
          <select id="portfolio" name="portfolio" defaultValue={selectedPortfolio} className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground">
            <option value="all">All portfolios</option>
            {PORTFOLIOS.map((portfolio) => (
              <option key={portfolio.slug} value={portfolio.slug}>
                {portfolio.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
          <label htmlFor="owner">Owner role</label>
          <select id="owner" name="owner" defaultValue={selectedOwner} className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground">
            <option value="all">All owners</option>
            {Array.from(new Set(flattenedVpActions.map((action) => action.ownerRole))).map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
          <label htmlFor="signal">Signal</label>
          <select id="signal" name="signal" defaultValue={selectedSignal} className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground">
            <option value="all">All signals</option>
            {Array.from(new Set(briefs.flatMap((brief) => inferSignals(brief).map((signal) => signal.label.toLowerCase())))).map((signal) => (
              <option key={signal} value={signal}>
                {signal}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
          <label htmlFor="due">Due window</label>
          <select id="due" name="due" defaultValue={selectedDue} className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground">
            <option value="all">All</option>
            <option value="7">Next 7 days</option>
            <option value="14">Next 14 days</option>
            <option value="30">Next 30 days</option>
          </select>
        </div>
        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
          <label htmlFor="q">Search</label>
          <input
            id="q"
            type="search"
            name="q"
            placeholder="Search actions or watchlist"
            defaultValue={resolvedSearchParams?.q ?? ""}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
        </div>
        <button type="submit" className="btn-primary text-sm">
          Apply filters
        </button>
      </form>

      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        {[
          { id: "actions", label: "Actions" },
          { id: "watchlist", label: "Watchlist" },
          { id: "leadership", label: "Leadership View" }
        ].map((tab) => (
          <Link
            key={tab.id}
            href={`/actions/${region}?tab=${tab.id}&portfolio=${selectedPortfolio}&owner=${selectedOwner}&signal=${selectedSignal}&due=${selectedDue}${query ? `&q=${encodeURIComponent(query)}` : ""}`}
            className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] ${
              activeTab === tab.id ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {activeTab === "actions" && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Actions</p>
              <h2 className="text-lg font-semibold text-foreground">Unified task list</h2>
            </div>
            <span className="text-xs text-muted-foreground">{filteredProcurement.length + filteredVpActions.length} items</span>
          </div>
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/20">
                  <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Due</th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Owner</th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Portfolio</th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Action</th>
                  <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Brief</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredVpActions.map((entry) => (
                  <tr key={`${entry.postId}-${entry.action}`} className="hover:bg-secondary/10">
                    <td className="px-4 py-3 text-xs text-muted-foreground">Due in {entry.dueInDays} days</td>
                    <td className="px-4 py-3 text-xs">{entry.ownerRole}</td>
                    <td className="px-4 py-3 text-xs">{portfolioLabel(entry.portfolio)}</td>
                    <td className="px-4 py-3 text-sm text-foreground">{entry.action}</td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/brief/${entry.postId}`} className="text-xs font-semibold text-primary hover:underline">
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
                {filteredProcurement.flatMap((entry) =>
                  entry.items.map((item, idx) => (
                    <tr key={`${entry.postId}-proc-${idx}`} className="hover:bg-secondary/10">
                      <td className="px-4 py-3 text-xs text-muted-foreground">—</td>
                      <td className="px-4 py-3 text-xs">Category Manager</td>
                      <td className="px-4 py-3 text-xs">{portfolioLabel(entry.portfolio)}</td>
                      <td className="px-4 py-3 text-sm text-foreground">{item}</td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/brief/${entry.postId}`} className="text-xs font-semibold text-primary hover:underline">
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {filteredProcurement.length + filteredVpActions.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">No actions match the current filters.</div>
            )}
          </div>
        </section>
      )}

      {activeTab === "watchlist" && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Watchlist</p>
              <h2 className="text-lg font-semibold text-foreground">Signals to monitor</h2>
            </div>
            <span className="text-xs text-muted-foreground">{filteredWatchlist.length} portfolios</span>
          </div>
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/20">
                  <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Signal</th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Portfolio</th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Item</th>
                  <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Brief</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredWatchlist.map((entry) =>
                  entry.items.map((item, idx) => (
                    <tr key={`${entry.postId}-watch-${idx}`} className="hover:bg-secondary/10">
                      <td className="px-4 py-3 text-xs text-muted-foreground">{entry.signal}</td>
                      <td className="px-4 py-3 text-xs">{portfolioLabel(entry.portfolio)}</td>
                      <td className="px-4 py-3 text-sm text-foreground">{item}</td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/brief/${entry.postId}`} className="text-xs font-semibold text-primary hover:underline">
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {filteredWatchlist.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">No watchlist items match the current filters.</div>
            )}
          </div>
        </section>
      )}

      {activeTab === "leadership" && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Leadership View</p>
              <h2 className="text-lg font-semibold text-foreground">Cross-portfolio themes</h2>
            </div>
            <span className="text-xs text-muted-foreground">{filteredVpActions.length} actions</span>
          </div>
          {Object.keys(leadershipThemes).length === 0 ? (
            <p className="text-sm text-muted-foreground">No leadership actions available.</p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {Object.entries(leadershipThemes).slice(0, 10).map(([theme, actions]) => (
                <div key={theme} className="rounded-lg border border-border bg-card p-4">
                  <h3 className="text-sm font-semibold text-foreground">{theme}</h3>
                  <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                    {actions.slice(0, 5).map((action) => (
                      <li key={`${action.postId}-${action.action}`} className="flex items-center justify-between gap-3">
                        <span className="text-foreground">{action.action}</span>
                        <Link href={`/brief/${action.postId}`} className="text-xs font-semibold text-primary hover:underline">
                          Brief
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
