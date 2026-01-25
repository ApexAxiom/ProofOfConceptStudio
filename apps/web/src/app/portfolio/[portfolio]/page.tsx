import Link from "next/link";
import {
  PORTFOLIOS,
  portfolioLabel,
  categoryForPortfolio,
  CATEGORY_META,
  getPortfolioSources,
  PortfolioSource,
  BriefPost
} from "@proof/shared";
import { fetchPosts } from "../../../lib/api";
import { getPortfolioPlaybook } from "../../../lib/portfolio-playbook";
import { inferSignals } from "../../../lib/signals";
import { PortfolioMarketTicker } from "../../../components/PortfolioMarketTicker";
import { BriefsTable } from "../../../components/BriefsTable";

interface PortfolioDashboardProps {
  params: Promise<{ portfolio: string }>;
  searchParams?: Promise<{ tab?: string }>;
}

function SourceCard({ source }: { source: PortfolioSource }) {
  const regionLabel = source.region === "apac" ? "🌏 APAC" : source.region === "intl" ? "🌎 INTL" : "🌐 Global";

  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-4 py-3 text-sm text-muted-foreground transition hover:border-primary/40"
    >
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{regionLabel}</p>
        <p className="truncate font-medium text-foreground">{source.name}</p>
      </div>
      <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
      </svg>
    </a>
  );
}

function SignalCard({ label, count, trend }: { label: string; count: number; trend: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-foreground">{count}</p>
      <p className="mt-1 text-xs text-muted-foreground">{trend}</p>
    </div>
  );
}

/**
 * Portfolio workbench page.
 */
export default async function PortfolioDashboard({ params, searchParams }: PortfolioDashboardProps) {
  const { portfolio } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const tabParam = resolvedSearchParams?.tab ?? "overview";
  const activeTab = ["overview", "briefs", "playbook", "kpis", "suppliers"].includes(tabParam)
    ? tabParam
    : "overview";

  const portfolioDef = PORTFOLIOS.find((p) => p.slug === portfolio);
  if (!portfolioDef) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
            <span className="text-2xl">🔍</span>
          </div>
          <h2 className="text-xl font-bold text-foreground">Portfolio Not Found</h2>
          <p className="mt-2 text-muted-foreground">The portfolio &ldquo;{portfolio}&rdquo; does not exist.</p>
          <Link href="/" className="btn-primary mt-6 inline-flex">Back to Morning Scan</Link>
        </div>
      </div>
    );
  }

  const category = categoryForPortfolio(portfolio);
  const categoryMeta = CATEGORY_META[category];

  const sources = getPortfolioSources(portfolio);
  const dedupedSources = Array.from(new Map(sources.map((source) => [source.url, source])).values());

  const [auBriefs, usBriefs] = await Promise.all([
    fetchPosts({ region: "au", portfolio, limit: 12 }).catch(() => [] as BriefPost[]),
    fetchPosts({ region: "us-mx-la-lng", portfolio, limit: 12 }).catch(() => [] as BriefPost[])
  ]);

  const allBriefs = [...auBriefs, ...usBriefs].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  const latestBrief = allBriefs[0];

  const signalCounts = allBriefs.reduce(
    (acc, brief) => {
      inferSignals(brief).forEach((signal) => {
        if (signal.type === "cost") acc.cost += 1;
        if (signal.type === "supply-risk") acc.supply += 1;
        if (signal.type === "regulatory") acc.regulatory += 1;
        if (signal.type === "commercial") acc.commercial += 1;
      });
      return acc;
    },
    { cost: 0, supply: 0, regulatory: 0, commercial: 0 }
  );

  const weeklyChanges = latestBrief?.decisionSummary?.whatChanged?.length
    ? latestBrief.decisionSummary.whatChanged
    : latestBrief?.deltaSinceLastRun ?? [];

  const recommendedActions = allBriefs
    .flatMap((brief) =>
      (brief.vpSnapshot?.recommendedActions ?? []).map((action) => ({
        ...action,
        postId: brief.postId,
        title: brief.title
      }))
    )
    .sort((a, b) => a.dueInDays - b.dueInDays)
    .slice(0, 5);

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "briefs", label: "Briefs" },
    { id: "playbook", label: "Category Playbook" },
    { id: "kpis", label: "KPIs" },
    { id: "suppliers", label: "Suppliers" }
  ];

  const playbook = getPortfolioPlaybook(portfolio);

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-primary">Morning Scan</Link>
            <span className="text-border">/</span>
            <span>{categoryMeta.label}</span>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: categoryMeta.color }} />
            <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">{portfolioLabel(portfolio)}</h1>
          </div>
          {portfolioDef.description && (
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{portfolioDef.description}</p>
          )}
        </div>
        <Link href={`/chat?portfolio=${portfolio}`} className="btn-secondary text-sm">
          Ask AI
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            href={`/portfolio/${portfolio}?tab=${tab.id}`}
            className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] ${
              activeTab === tab.id ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {activeTab === "overview" && (
        <div className="space-y-8">
          <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <SignalCard label="Cost" count={signalCounts.cost} trend="Signals in last 14 days" />
            <SignalCard label="Supply" count={signalCounts.supply} trend="Supply risk highlights" />
            <SignalCard label="Regulatory" count={signalCounts.regulatory} trend="Policy and compliance" />
            <SignalCard label="Commercial" count={signalCounts.commercial} trend="Pricing and contract shifts" />
          </section>

          <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-sm font-semibold text-foreground">What changed this week</h2>
              {weeklyChanges.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">No deltas captured yet.</p>
              ) : (
                <ul className="mt-3 space-y-2 text-sm text-foreground">
                  {weeklyChanges.slice(0, 6).map((item, idx) => (
                    <li key={`${item}-${idx}`} className="flex gap-2">
                      <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-sm font-semibold text-foreground">Top recommended actions</h2>
              {recommendedActions.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">No actions yet for this portfolio.</p>
              ) : (
                <ul className="mt-3 space-y-3 text-sm text-foreground">
                  {recommendedActions.map((action) => (
                    <li key={`${action.postId}-${action.action}`} className="rounded-lg border border-border bg-background px-3 py-2">
                      <Link href={`/brief/${action.postId}`} className="font-semibold text-foreground hover:text-primary">
                        {action.action}
                      </Link>
                      <p className="text-xs text-muted-foreground">Due in {action.dueInDays} days · {action.ownerRole}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Briefs to review</h2>
              <span className="text-xs text-muted-foreground">Latest {Math.min(5, allBriefs.length)}</span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {allBriefs.slice(0, 5).map((brief) => (
                <Link
                  key={brief.postId}
                  href={`/brief/${brief.postId}`}
                  className="rounded-lg border border-border bg-background p-3 text-sm transition hover:border-primary/40"
                >
                  <p className="font-semibold text-foreground line-clamp-2">{brief.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {brief.region === "au" ? "APAC" : "INTL"} · {new Date(brief.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </p>
                </Link>
              ))}
              {allBriefs.length === 0 && (
                <p className="text-sm text-muted-foreground">No briefs yet.</p>
              )}
            </div>
            {allBriefs.length > 5 && (
              <Link href={`/portfolio/${portfolio}?tab=briefs`} className="mt-4 inline-flex text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                View all briefs
              </Link>
            )}
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <PortfolioMarketTicker portfolio={portfolio} />
          </section>

          <details className="rounded-xl border border-border bg-card">
            <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-foreground">Sources ({dedupedSources.length})</summary>
            <div className="space-y-2 px-5 pb-5">
              {dedupedSources.length > 0 ? (
                dedupedSources.map((source) => <SourceCard key={source.url} source={source} />)
              ) : (
                <p className="text-sm text-muted-foreground">No sources configured.</p>
              )}
            </div>
          </details>
        </div>
      )}

      {activeTab === "briefs" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold text-foreground">Brief history</h2>
            <p className="mt-1 text-xs text-muted-foreground">Latest intelligence briefs across regions.</p>
          </div>
          {allBriefs.length > 0 ? (
            <BriefsTable briefs={allBriefs} showRegion={true} variant="history" />
          ) : (
            <p className="text-sm text-muted-foreground">No briefs available yet.</p>
          )}
        </div>
      )}

      {activeTab === "playbook" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold text-foreground">Category Playbook</h2>
            <p className="mt-1 text-xs text-muted-foreground">Weekly refresh. Built to keep daily briefs concise.</p>
          </div>
          {playbook ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-border bg-card p-5">
                <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Key KPIs</h3>
                <ul className="mt-3 space-y-2 text-sm text-foreground list-disc pl-4">
                  {playbook.kpis.map((kpi) => (
                    <li key={kpi}>{kpi}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border border-border bg-card p-5">
                <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Negotiation Levers</h3>
                <ul className="mt-3 space-y-2 text-sm text-foreground list-disc pl-4">
                  {playbook.levers.map((lever) => (
                    <li key={lever}>{lever}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-secondary/30 p-8 text-center">
              <p className="text-sm text-muted-foreground">Playbook details will be added after the first category cycle.</p>
            </div>
          )}
        </div>
      )}

      {activeTab === "kpis" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold text-foreground">KPIs</h2>
            <p className="mt-1 text-xs text-muted-foreground">Sparkline trends roll up weekly using the playbook KPIs.</p>
          </div>
          {playbook ? (
            <div className="grid gap-3 md:grid-cols-2">
              {playbook.kpis.map((kpi) => (
                <div key={kpi} className="rounded-lg border border-border bg-card p-4">
                  <p className="text-sm font-medium text-foreground">{kpi}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Trend view coming soon.</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">KPIs will appear once the playbook is configured.</p>
          )}
        </div>
      )}

      {activeTab === "suppliers" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold text-foreground">Suppliers</h2>
            <p className="mt-1 text-xs text-muted-foreground">Top vendors and notes captured from briefs.</p>
          </div>
          <div className="rounded-xl border border-dashed border-border bg-secondary/30 p-8 text-center">
            <p className="text-sm text-muted-foreground">Supplier notes will populate as briefs are published.</p>
          </div>
        </div>
      )}

      <div className="border-t border-border pt-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm text-muted-foreground">
            Part of <span className="font-medium text-foreground">{categoryMeta.label}</span> category
          </span>
          <div className="flex gap-2">
            <Link href={`/au/${portfolio}`} className="btn-ghost text-xs py-1.5">
              🇦🇺 AU Region
            </Link>
            <Link href={`/us-mx-la-lng/${portfolio}`} className="btn-ghost text-xs py-1.5">
              🇺🇸 US Region
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
