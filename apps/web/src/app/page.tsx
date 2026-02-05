import Link from "next/link";
import { fetchLatest } from "../lib/api";
import { getExecutiveDashboardData, ExecutiveArticle } from "../lib/executive-dashboard";
import { inferSignals } from "../lib/signals";
import { CATEGORY_META, categoryForPortfolio, portfolioLabel, regionLabel } from "@proof/shared";

function SectionHeading({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

function NewsItem({ article }: { article: ExecutiveArticle }) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noreferrer noopener"
      className="flex items-start justify-between gap-4 rounded-lg border border-border bg-background px-4 py-3 text-sm text-muted-foreground transition hover:border-primary/40"
    >
      <div className="min-w-0 space-y-1">
        <p className="font-semibold text-foreground line-clamp-2">{article.title}</p>
        <p className="text-xs text-muted-foreground">
          {article.source} · {new Date(article.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </p>
        {article.summary && <p className="text-xs text-muted-foreground line-clamp-2">{article.summary}</p>}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{article.category}</span>
        {article.imageUrl && (
          <img
            src={article.imageUrl}
            alt={article.title}
            className="h-16 w-20 rounded-md object-cover"
            loading="lazy"
          />
        )}
      </div>
    </a>
  );
}

/**
 * Morning Scan dashboard.
 */
export default async function Dashboard() {
  const [auBriefs, usBriefs, executiveDashboard] = await Promise.all([
    fetchLatest("au"),
    fetchLatest("us-mx-la-lng"),
    getExecutiveDashboardData()
  ]);

  const allBriefs = [...auBriefs, ...usBriefs].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  const topMoves = allBriefs.slice(0, 5).map((brief) => {
    const signals = inferSignals(brief);
    const decisionSummary = brief.decisionSummary;
    return {
      postId: brief.postId,
      title: brief.title,
      portfolio: brief.portfolio,
      region: brief.region,
      publishedAt: brief.publishedAt,
      summary: decisionSummary?.topMove || brief.summary || "Latest market movement",
      whatChanged: decisionSummary?.whatChanged?.[0] || brief.deltaSinceLastRun?.[0],
      doNext: decisionSummary?.doNext?.[0] || brief.procurementActions?.[0],
      signals
    };
  });

  const actionItems = allBriefs
    .flatMap((brief) =>
      (brief.vpSnapshot?.recommendedActions ?? []).map((action) => ({
        postId: brief.postId,
        title: brief.title,
        portfolio: brief.portfolio,
        action: action.action,
        dueInDays: action.dueInDays,
        ownerRole: action.ownerRole
      }))
    )
    .sort((a, b) => (a.dueInDays ?? 0) - (b.dueInDays ?? 0))
    .slice(0, 5);

  const briefsToReview = allBriefs.slice(0, 5);

  const categoryOverview = (() => {
    const categoryMap = new Map<string, typeof allBriefs[number]>();
    for (const brief of allBriefs) {
      const category = categoryForPortfolio(brief.portfolio);
      if (!categoryMap.has(category)) {
        categoryMap.set(category, brief);
      }
      if (categoryMap.size >= 5) break;
    }
    return Array.from(categoryMap.entries()).map(([category, brief]) => ({
      category,
      brief
    }));
  })();

  const woodsideSpotlight = executiveDashboard.woodsideArticles.slice(0, 4);

  const latestNews = [
    ...executiveDashboard.woodsideArticles,
    ...executiveDashboard.apacArticles,
    ...executiveDashboard.internationalArticles
  ].slice(0, 15);

  return (
    <div className="space-y-8">
      <header className="rounded-2xl border border-border bg-card p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Morning Scan</p>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">Today at a glance</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Focused signal triage for category managers: what changed, so what, and the next best action.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
          <SectionHeading title="Top moves today" description="Ranked by recency and relevance. Max 5." />
          <div className="mt-4 space-y-3">
            {topMoves.map((move) => (
              <Link
                key={move.postId}
                href={`/brief/${move.postId}`}
                className="block rounded-lg border border-border bg-background p-4 transition hover:border-primary/40"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>{portfolioLabel(move.portfolio)} · {regionLabel(move.region)}</span>
                  <span>{new Date(move.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                </div>
                <h3 className="mt-2 text-sm font-semibold text-foreground">{move.summary}</h3>
                {move.whatChanged && (
                  <p className="mt-1 text-xs text-muted-foreground">What changed: {move.whatChanged}</p>
                )}
                {move.doNext && (
                  <p className="mt-1 text-xs text-muted-foreground">Now what: {move.doNext}</p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {move.signals.map((signal) => (
                    <span key={`${move.postId}-${signal.type}`} className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      {signal.label}
                    </span>
                  ))}
                </div>
              </Link>
            ))}
            {topMoves.length === 0 && (
              <p className="text-sm text-muted-foreground">No briefs published yet for today.</p>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-5">
            <SectionHeading title="Category overview" description="Top 5 categories represented today." />
            <div className="mt-4 space-y-3">
              {categoryOverview.map(({ category, brief }) => (
                <Link
                  key={`${category}-${brief.postId}`}
                  href={`/brief/${brief.postId}`}
                  className="block rounded-lg border border-border bg-background p-3 text-sm transition hover:border-primary/40"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    {CATEGORY_META[category].label}
                  </p>
                  <p className="mt-1 font-semibold text-foreground line-clamp-2">{brief.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {portfolioLabel(brief.portfolio)} · {regionLabel(brief.region)}
                  </p>
                </Link>
              ))}
              {categoryOverview.length === 0 && (
                <p className="text-sm text-muted-foreground">No category briefs available yet.</p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <SectionHeading title="Actions due soon" description="Highest urgency recommendations." />
            <div className="mt-4 space-y-3">
              {actionItems.map((item) => (
                <Link
                  key={`${item.postId}-${item.action}`}
                  href={`/brief/${item.postId}`}
                  className="block rounded-lg border border-border bg-background p-3 text-sm transition hover:border-primary/40"
                >
                  <p className="font-semibold text-foreground">{item.action}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {portfolioLabel(item.portfolio)} · Due in {item.dueInDays} days
                  </p>
                </Link>
              ))}
              {actionItems.length === 0 && (
                <p className="text-sm text-muted-foreground">No urgent actions flagged yet.</p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <SectionHeading title="Briefs to review" description="Latest briefs across regions." />
            <div className="mt-4 space-y-3">
              {briefsToReview.map((brief) => (
                <Link
                  key={brief.postId}
                  href={`/brief/${brief.postId}`}
                  className="block rounded-lg border border-border bg-background p-3 text-sm transition hover:border-primary/40"
                >
                  <p className="font-semibold text-foreground line-clamp-2">{brief.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {portfolioLabel(brief.portfolio)} · {regionLabel(brief.region)}
                  </p>
                </Link>
              ))}
              {briefsToReview.length === 0 && (
                <p className="text-sm text-muted-foreground">No briefs available yet.</p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <SectionHeading
          title="Woodside spotlight"
          description="Latest Woodside coverage surfaced first."
          action={<span className="text-xs text-muted-foreground">Updated daily</span>}
        />
        <div className="mt-4 space-y-3">
          {woodsideSpotlight.map((article) => (
            <NewsItem key={article.url} article={article} />
          ))}
          {woodsideSpotlight.length === 0 && (
            <p className="text-sm text-muted-foreground">No Woodside headlines available yet.</p>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <SectionHeading
          title="All updates"
          description="Everything from APAC, International, and Woodside feeds."
          action={<span className="text-xs text-muted-foreground">Updated daily</span>}
        />
        <div className="mt-4 space-y-3">
          {latestNews.map((article) => (
            <NewsItem key={article.url} article={article} />
          ))}
          {latestNews.length === 0 && (
            <p className="text-sm text-muted-foreground">No updates available yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
