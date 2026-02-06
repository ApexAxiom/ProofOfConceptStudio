import Link from "next/link";
import { BriefPost, RegionSlug, findPortfolio, portfolioLabel, regionLabel, toBriefViewModelV2 } from "@proof/shared";
import { fetchPosts } from "../../../lib/api";
import { getPortfolioNews } from "../../../lib/portfolio-news";
import { PortfolioMarketTicker } from "../../../components/PortfolioMarketTicker";
import { PortfolioBriefHistory } from "../../../components/PortfolioBriefHistory";

interface PortfolioOverviewPageProps {
  params: Promise<{ portfolio: string }>;
  searchParams?: Promise<{ briefRegion?: string }>;
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
      summary: "Daily intelligence update is being prepared for this portfolio.",
      impact: ["Signal monitoring remains active across both regions for this portfolio."],
      actions: ["Review latest portfolio news and source signals while the next published update completes."]
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
      title: `${portfolioLabel(portfolio)} — Daily intelligence update pending`,
      region: "au",
      portfolio,
      runWindow: "apac",
      status: "published",
      publishedAt: now,
      summary: "Daily intelligence update is being initialized.",
      bodyMarkdown: "Daily intelligence update is being initialized.",
      tags: ["baseline"]
    },
    {
      postId: `baseline-${portfolio}-intl`,
      title: `${portfolioLabel(portfolio)} — Daily intelligence update pending`,
      region: "us-mx-la-lng",
      portfolio,
      runWindow: "international",
      status: "published",
      publishedAt: now,
      summary: "Daily intelligence update is being initialized.",
      bodyMarkdown: "Daily intelligence update is being initialized.",
      tags: ["baseline"]
    }
  ];
}

/**
 * Category overview page for a selected portfolio.
 */
export default async function PortfolioOverviewPage({ params, searchParams }: PortfolioOverviewPageProps) {
  const { portfolio } = await params;
  const query = searchParams ? await searchParams : undefined;
  const selectedRegion: RegionSlug =
    query?.briefRegion === "us-mx-la-lng" || query?.briefRegion === "au" ? query.briefRegion : "au";
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
  const latestByRegion: Record<RegionSlug, BriefPost | undefined> = {
    au: auBriefs[0],
    "us-mx-la-lng": intlBriefs[0]
  };
  const activeBrief = latestByRegion[selectedRegion];
  const activeBriefView = activeBrief ? toBriefViewModelV2(activeBrief, { defaultRegion: selectedRegion }) : null;

  return (
    <div className="space-y-8">
      <header className="rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Link href="/" className="hover:text-primary transition-colors">
                Executive View
              </Link>
              <span>/</span>
              <span>Portfolio Intelligence</span>
            </div>
            <h1 className="mt-2 text-2xl font-semibold text-foreground">{portfolioLabel(portfolio)}</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{portfolioDef.description}</p>
          </div>
          <div className="flex min-w-[280px] flex-col items-stretch gap-2 sm:min-w-[360px]">
            <div className="inline-flex rounded-lg border border-border bg-background p-1 text-xs">
              <Link
                href={`/portfolio/${portfolio}?briefRegion=au`}
                className={`rounded-md px-3 py-1.5 font-semibold transition-colors ${
                  selectedRegion === "au" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                APAC
              </Link>
              <Link
                href={`/portfolio/${portfolio}?briefRegion=us-mx-la-lng`}
                className={`rounded-md px-3 py-1.5 font-semibold transition-colors ${
                  selectedRegion === "us-mx-la-lng"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                International (US/Mexico/Senegal)
              </Link>
            </div>
            <Link href={`/chat?portfolio=${portfolio}`} className="btn-secondary text-sm text-center">
              Ask AI
            </Link>
          </div>
        </div>
      </header>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-foreground">Daily Intelligence Update</h2>
          <p className="text-sm text-muted-foreground">
            {selectedRegion === "au" ? "APAC view" : "International view"} for this portfolio.
          </p>
        </div>

        {activeBriefView ? (
          <article className="mt-4 space-y-4">
            <img
              src={activeBriefView.heroImage.url}
              alt={activeBriefView.heroImage.alt}
              className="h-52 w-full rounded-lg border border-border bg-background object-cover sm:h-64"
              loading="lazy"
            />
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {regionLabel(activeBriefView.region)} · {activeBriefView.dateLabel}
              </p>
              <h3 className="text-xl font-semibold text-foreground">{activeBriefView.title}</h3>
              <p className="text-sm text-foreground">{insight.summary}</p>
            </div>
            {activeBriefView.deltaBullets.length > 0 ? (
              <ul className="space-y-1 text-sm text-muted-foreground">
                {activeBriefView.deltaBullets.map((item, idx) => (
                  <li key={`${item}-${idx}`} className="flex gap-2">
                    <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="grid gap-4 lg:grid-cols-2">
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
            <div className="grid gap-3 md:grid-cols-2">
              {activeBriefView.topStories.slice(0, 3).map((story, idx) => (
                <article key={`${story.url}-${idx}`} className="rounded-lg border border-border bg-background p-3">
                  <a href={story.url} target="_blank" rel="noreferrer noopener" className="text-sm font-semibold text-foreground hover:text-primary">
                    {story.title}
                  </a>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {story.sourceName ?? "source"} ·{" "}
                    {story.publishedAt ? new Date(story.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "n.d."}
                  </p>
                  {story.categoryImportance ? <p className="mt-2 text-xs text-muted-foreground">{story.categoryImportance}</p> : null}
                </article>
              ))}
            </div>
            <Link href={`/brief/${activeBrief.postId}`} className="btn-secondary text-sm">
              Open Full Brief
            </Link>
          </article>
        ) : (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-foreground">{insight.summary}</p>
            <div className="grid gap-4 lg:grid-cols-2">
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
          </div>
        )}
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
                {article.source} ·{" "}
                {new Date(article.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </p>
            </a>
          ))}
          {portfolioNews.length === 0 ? (
            <p className="text-sm text-muted-foreground">News feed refresh in progress. Check back in the next run cycle.</p>
          ) : null}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <PortfolioMarketTicker portfolio={portfolio} variant="grid" limit={4} showHeader />
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        {history.length > 0 ? (
          <PortfolioBriefHistory briefs={history} />
        ) : (
          <div className="space-y-2 rounded-lg border border-border bg-background p-4">
            <h2 className="text-lg font-semibold text-foreground">Daily brief history</h2>
            <p className="text-sm text-muted-foreground">Previous briefs are listed below.</p>
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
