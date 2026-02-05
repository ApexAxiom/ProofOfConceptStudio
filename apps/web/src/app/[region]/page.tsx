import Link from "next/link";
import { RegionTabs } from "../../components/RegionTabs";
import { PortfolioNav } from "../../components/PortfolioNav";
import { BriefsTable } from "../../components/BriefsTable";
import { LiveMarketTicker } from "../../components/LiveMarketTicker";
import { RegionSlug, REGIONS } from "@proof/shared";
import { fetchLatestByPortfolio } from "../../lib/api";
import { inferSignals } from "../../lib/signals";

export default async function RegionPage({
  params,
  searchParams
}: {
  params: Promise<{ region: RegionSlug }>;
  searchParams?: Promise<{ signal?: string; sort?: string; q?: string | string[] }>;
}) {
  const { region } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const queryValue = Array.isArray(resolvedSearchParams?.q)
    ? resolvedSearchParams?.q[0]
    : resolvedSearchParams?.q;
  const query = (queryValue ?? "").toLowerCase().trim();
  const selectedSignal = resolvedSearchParams?.signal ?? "all";
  const sort = resolvedSearchParams?.sort ?? "newest";
  const briefs = await fetchLatestByPortfolio(region);
  const portfoliosWithBriefs = new Set(briefs.map(b => b.portfolio)).size;

  const filteredBriefs = briefs.filter((brief) => {
    const matchesQuery = query
      ? `${brief.title} ${brief.summary ?? ""} ${brief.tags?.join(" ") ?? ""}`.toLowerCase().includes(query)
      : true;
    if (!matchesQuery) return false;
    if (selectedSignal === "all") return true;
    const signals = inferSignals(brief).map((signal) => signal.type);
    return signals.includes(selectedSignal as ReturnType<typeof inferSignals>[number]["type"]);
  });

  const getRiskScore = (brief: typeof briefs[number]) => {
    const signals = inferSignals(brief).map((signal) => signal.type);
    return signals.reduce((score, type) => {
      if (type === "supply-risk" || type === "regulatory" || type === "cyber") return score + 2;
      if (type === "cost") return score + 1;
      return score;
    }, 0);
  };

  const sortedBriefs = [...filteredBriefs].sort((a, b) => {
    if (sort === "risk") {
      const delta = getRiskScore(b) - getRiskScore(a);
      if (delta !== 0) return delta;
    }
    if (sort === "cost") {
      const delta = (inferSignals(b).some((signal) => signal.type === "cost") ? 1 : 0) -
        (inferSignals(a).some((signal) => signal.type === "cost") ? 1 : 0);
      if (delta !== 0) return delta;
    }
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  });
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Link href="/" className="hover:text-foreground transition-colors">Dashboard</Link>
            <span>/</span>
            <span className="text-foreground">{REGIONS[region].label}</span>
          </div>
          <h1 className="text-xl font-bold text-foreground sm:text-2xl">
            {REGIONS[region].label}
          </h1>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-muted-foreground">
            <span className="font-semibold text-foreground">{briefs.length}</span> briefs
          </span>
          <span className="text-muted-foreground">
            <span className="font-semibold text-foreground">{portfoliosWithBriefs}</span> active categories
          </span>
          <Link href="/chat" className="btn-secondary text-sm">Ask AI</Link>
        </div>
      </div>

      {/* Region Tabs */}
      <RegionTabs activeRegion={region} showGlobalTab={true} />

      {/* Market Indices */}
      <div className="rounded-lg border border-border bg-card p-4">
        <LiveMarketTicker showHeader={true} />
      </div>
      
      {/* Category Filter */}
      <div className="space-y-3">
        <details className="rounded-lg border border-border bg-card p-4" open>
          <summary className="cursor-pointer text-sm font-semibold text-foreground">Browse by Category</summary>
          <div className="mt-3">
            <PortfolioNav region={region} />
          </div>
        </details>
      </div>
      
      {/* Briefs Table */}
      <div className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Intelligence Briefs</h2>
            <p className="text-xs text-muted-foreground">Filter by signal type or search by keyword.</p>
          </div>
          <form className="flex flex-wrap gap-2" role="search">
            <input type="hidden" name="signal" value={selectedSignal} />
            <input type="hidden" name="sort" value={sort} />
            <input
              type="search"
              name="q"
              placeholder="Search title or keyword"
              defaultValue={resolvedSearchParams?.q ?? ""}
              className="min-w-[220px] rounded-md border border-border bg-background px-3 py-2 text-xs"
            />
            <button type="submit" className="btn-secondary text-xs">
              Search
            </button>
          </form>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {["all", "cost", "supply-risk", "regulatory", "cyber", "commercial"].map((signal) => (
            <Link
              key={signal}
              href={`/${region}?signal=${signal}&sort=${sort}${query ? `&q=${encodeURIComponent(query)}` : ""}`}
              className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] ${
                selectedSignal === signal ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground"
              }`}
            >
              {signal === "supply-risk" ? "Supply Risk" : signal === "all" ? "All Signals" : signal.replace("-", " ")}
            </Link>
          ))}
          <form className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            <input type="hidden" name="signal" value={selectedSignal} />
            <input type="hidden" name="q" value={query} />
            <label htmlFor="sort" className="text-xs text-muted-foreground">
              Sort
            </label>
            <select
              id="sort"
              name="sort"
              defaultValue={sort}
              className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
            >
              <option value="newest">Newest</option>
              <option value="risk">Highest risk</option>
              <option value="cost">Cost focus</option>
            </select>
            <button type="submit" className="btn-ghost text-xs">
              Apply
            </button>
          </form>
        </div>
        {sortedBriefs.length > 0 ? (
          <BriefsTable briefs={sortedBriefs} showRegion={false} />
        ) : (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 py-12 text-center">
            <svg className="h-10 w-10 text-muted-foreground mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            <h4 className="text-base font-semibold text-foreground">Coverage refresh in progress</h4>
            <p className="mt-1 text-sm text-muted-foreground">Baseline or carry-forward briefs will be published for this cycle.</p>
          </div>
        )}
      </div>
    </div>
  );
}
