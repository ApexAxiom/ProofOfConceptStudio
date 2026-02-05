import Link from "next/link";
import { BriefPost, findPortfolio, portfolioLabel, regionLabel } from "@proof/shared";
import { fetchPosts } from "../../../lib/api";
import { getPortfolioNews } from "../../../lib/portfolio-news";
import { PortfolioMarketTicker } from "../../../components/PortfolioMarketTicker";
import { BriefsTable } from "../../../components/BriefsTable";

interface PortfolioOverviewPageProps {
  params: Promise<{ portfolio: string }>;
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (!value) continue;
    const key = value.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(key);
  }
  return result;
}

function deriveWhatsHappening(briefs: BriefPost[]): {
  summary: string;
  impact: string[];
  actions: string[];
} {
  const latest = briefs[0];
  if (!latest) {
    return {
      summary:
        "No published brief is available yet for this portfolio. A baseline brief is auto-published during the next coverage cycle.",
      impact: ["Coverage monitor is tracking this portfolio and region pair for today’s publication window."],
      actions: ["Review portfolio news and source links while the baseline brief initializes."]
    };
  }

  const summary =
    latest.summary?.trim() ||
    latest.decisionSummary?.topMove?.trim() ||
    "Latest market and category movement is reflected in today’s published brief.";

  const impact = uniqueStrings([
    ...(latest.decisionSummary?.whatChanged ?? []),
    ...(latest.highlights ?? []),
    ...(latest.deltaSinceLastRun ?? []),
    latest.vpSnapshot?.health?.narrative
  ]).slice(0, 6);

  const actions = uniqueStrings([
    ...(latest.decisionSummary?.doNext ?? []),
    ...(latest.procurementActions ?? []),
    ...(latest.vpSnapshot?.recommendedActions ?? []).map((item) => item.action)
  ]).slice(0, 6);

  return {
    summary,
    impact: impact.length > 0 ? impact : ["No major impact deltas were captured in the latest run."],
    actions: actions.length > 0 ? actions : ["Monitor next run for concrete category actions."]
  };
}

function fallbackHistory(portfolio: string): BriefPost[] {
  const now = new Date().toISOString();
  return [
    {
      postId: `baseline-${portfolio}-au`,
      title: `${portfolioLabel(portfolio)} — Baseline brief pending`,
      region: "au",
      portfolio,
      runWindow: "apac",
      status: "published",
      publishedAt: now,
      summary: "Baseline brief is being initialized.",
      bodyMarkdown: "Baseline brief is being initialized.",
      tags: ["baseline"]
    },
    {
      postId: `baseline-${portfolio}-intl`,
      title: `${portfolioLabel(portfolio)} — Baseline brief pending`,
      region: "us-mx-la-lng",
      portfolio,
      runWindow: "international",
      status: "published",
      publishedAt: now,
      summary: "Baseline brief is being initialized.",
      bodyMarkdown: "Baseline brief is being initialized.",
      tags: ["baseline"]
    }
  ];
}

/**
 * Category overview page for a selected portfolio.
 */
export default async function PortfolioOverviewPage({ params }: PortfolioOverviewPageProps) {
  const { portfolio } = await params;
  const portfolioDef = findPortfolio(portfolio);

  if (!portfolioDef) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <h1 className="text-xl font-semibold text-foreground">Portfolio not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">{portfolio} is not configured.</p>
        <Link href="/" className="btn-secondary mt-4 inline-flex">
          Back to Executive View
        </Link>
      </div>
    );
  }

  const [auBriefs, intlBriefs, portfolioNews] = await Promise.all([
    fetchPosts({ region: "au", portfolio, limit: 120 }).catch(() => [] as BriefPost[]),
    fetchPosts({ region: "us-mx-la-lng", portfolio, limit: 120 }).catch(() => [] as BriefPost[]),
    getPortfolioNews(portfolio, 12).catch(() => [])
  ]);

  const history = [...auBriefs, ...intlBriefs]
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  const insight = deriveWhatsHappening(history);

  return (
    <div className="space-y-8">
      <header className="rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Link href="/" className="hover:text-primary transition-colors">
                Executive View
              </Link>
              <span>/</span>
              <span>{portfolioLabel(portfolio)}</span>
            </div>
            <h1 className="mt-2 text-2xl font-semibold text-foreground">{portfolioLabel(portfolio)}</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{portfolioDef.description}</p>
          </div>
          <Link href={`/chat?portfolio=${portfolio}`} className="btn-secondary text-sm">
            Ask AI
          </Link>
        </div>
      </header>

      <section className="rounded-xl border border-border bg-card p-5">
        <PortfolioMarketTicker portfolio={portfolio} variant="grid" limit={6} showHeader />
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold text-foreground">What’s happening</h2>
        <p className="mt-3 text-sm text-foreground">{insight.summary}</p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Impact</h3>
            <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
              {insight.impact.map((item, idx) => (
                <li key={`${item}-${idx}`} className="flex gap-2">
                  <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Possible actions</h3>
            <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
              {insight.actions.map((item, idx) => (
                <li key={`${item}-${idx}`} className="flex gap-2">
                  <span className="mt-1 h-2 w-2 rounded-full bg-amber-500" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold text-foreground">Latest portfolio news</h2>
        <p className="text-sm text-muted-foreground">Scoped to this category’s configured sources and query terms.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {portfolioNews.map((article) => (
            <a
              key={article.url}
              href={article.url}
              target="_blank"
              rel="noreferrer noopener"
              className="rounded-lg border border-border bg-background p-3 transition hover:border-primary/40"
            >
              <p className="text-sm font-semibold text-foreground line-clamp-2">{article.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {article.region} · {article.source} ·{" "}
                {new Date(article.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </p>
              {article.summary ? <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{article.summary}</p> : null}
            </a>
          ))}
          {portfolioNews.length === 0 ? (
            <p className="text-sm text-muted-foreground">News feed refresh in progress. Check back in the next run cycle.</p>
          ) : null}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold text-foreground">Daily brief history</h2>
        <p className="text-sm text-muted-foreground">Chronological brief log across APAC and International regions.</p>
        <div className="mt-4">
          {history.length > 0 ? (
            <BriefsTable briefs={history} showRegion variant="history" />
          ) : (
            <div className="space-y-2 rounded-lg border border-border bg-background p-4">
              {fallbackHistory(portfolio).map((item) => (
                <div key={item.postId} className="rounded-md border border-border bg-card p-3">
                  <p className="text-sm font-semibold text-foreground">{item.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {regionLabel(item.region)} · {new Date(item.publishedAt).toLocaleDateString("en-US")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
        {history.length > 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Latest published: {new Date(history[0].publishedAt).toLocaleDateString("en-US")} ·{" "}
            {regionLabel(history[0].region)}
          </p>
        ) : null}
      </section>
    </div>
  );
}
