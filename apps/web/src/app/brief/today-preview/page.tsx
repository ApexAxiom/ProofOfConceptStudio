import Link from "next/link";
import { portfolioLabel, regionLabel } from "@proof/shared";
import { BriefDetailContent } from "../BriefDetailContent";
import { getTodayPreviewBriefs } from "../../../lib/today-preview";

export const dynamic = "force-dynamic";

export default function TodayPreviewPage() {
  const briefs = getTodayPreviewBriefs();

  return (
    <div className="space-y-8">
      <header className="rounded-2xl border border-border bg-card p-6 md:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Brief layout preview
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-foreground">Today&apos;s briefs rewritten in the new format</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This preview upgrades the repository&apos;s today-dated sample briefs into the new structured report format so you can inspect the redesigned layout without touching production data.
            </p>
          </div>
          <div className="flex shrink-0 items-start gap-3 md:pt-1">
            <Link href="/" className="btn-secondary text-sm">
              Back to Executive View
            </Link>
          </div>
        </div>
      </header>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold text-foreground">Included preview briefs</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {briefs.length} sample briefs were normalized into the new layout for the current day.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {briefs.map((brief) => (
            <a
              key={brief.postId}
              href={`#${brief.postId}`}
              className="rounded-lg border border-border bg-background p-4 transition hover:border-primary/40"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {regionLabel(brief.region)}
              </p>
              <p className="mt-2 text-sm font-semibold text-foreground">{portfolioLabel(brief.portfolio)}</p>
              <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{brief.title}</p>
            </a>
          ))}
        </div>
      </section>

      <div className="space-y-12">
        {briefs.map((brief) => (
          <section key={brief.postId} id={brief.postId} className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {regionLabel(brief.region)} · {portfolioLabel(brief.portfolio)}
                </p>
                <h2 className="mt-1 text-xl font-semibold text-foreground">{brief.title}</h2>
              </div>
              <a href="#top" className="text-sm font-medium text-primary hover:text-primary/80">
                Back to list
              </a>
            </div>
            <BriefDetailContent brief={brief} />
          </section>
        ))}
      </div>
    </div>
  );
}
