import Link from "next/link";
import { fetchLatest } from "../../lib/api";
import { getExecutiveDashboardData } from "../../lib/executive-dashboard";
import { portfolioLabel, regionLabel } from "@proof/shared";

/**
 * Morning Scan route preserved as a secondary daily triage view.
 */
export default async function MorningScanPage() {
  const [auBriefs, intlBriefs, executive] = await Promise.all([
    fetchLatest("au"),
    fetchLatest("us-mx-la-lng"),
    getExecutiveDashboardData()
  ]);

  const briefs = [...auBriefs, ...intlBriefs]
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, 8);

  const updates = [...executive.woodside.articles, ...executive.apac.articles, ...executive.international.articles].slice(0, 10);

  return (
    <div className="space-y-8">
      <header className="rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Morning Scan</p>
            <h1 className="mt-2 text-2xl font-semibold text-foreground">Today at a glance</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Rapid triage of today’s brief activity and headline flow.
            </p>
          </div>
          <Link href="/" className="btn-secondary text-sm">
            Back to Executive View
          </Link>
        </div>
      </header>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold text-foreground">Latest briefs</h2>
        <div className="mt-4 space-y-2">
          {briefs.map((brief) => (
            <Link
              key={brief.postId}
              href={`/brief/${brief.postId}`}
              className="block rounded-lg border border-border bg-background p-3 transition hover:border-primary/40"
            >
              <p className="text-sm font-semibold text-foreground line-clamp-1">{brief.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {portfolioLabel(brief.portfolio)} · {regionLabel(brief.region)} ·{" "}
                {new Date(brief.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </p>
            </Link>
          ))}
          {briefs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Brief ingestion is in progress for this cycle.</p>
          ) : null}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold text-foreground">All updates</h2>
        <div className="mt-4 space-y-2">
          {updates.map((article) => (
            <a
              key={article.url}
              href={article.url}
              target="_blank"
              rel="noreferrer noopener"
              className="block rounded-lg border border-border bg-background p-3 transition hover:border-primary/40"
            >
              <p className="text-sm font-semibold text-foreground line-clamp-2">{article.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {article.source} · {new Date(article.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </p>
            </a>
          ))}
          {updates.length === 0 ? <p className="text-sm text-muted-foreground">No updates available.</p> : null}
        </div>
      </section>
    </div>
  );
}
