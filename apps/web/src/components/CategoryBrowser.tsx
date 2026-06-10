import Link from "next/link";
import {
  BriefPost,
  CATEGORY_META,
  PORTFOLIOS,
  RegionSlug,
  categoryForPortfolio
} from "@proof/shared";
import { SignalBadge } from "./SignalBadge";

/**
 * Grouped category navigation for the executive view: portfolios organised by
 * category, each showing its latest brief's signal level so triage is visible
 * before tapping through.
 */
export function CategoryBrowser({ region, briefs }: { region: RegionSlug; briefs: BriefPost[] }) {
  const latestByPortfolio = new Map(briefs.map((brief) => [brief.portfolio, brief]));

  const groups = Object.values(CATEGORY_META)
    .map((category) => ({
      category,
      portfolios: PORTFOLIOS.filter((portfolio) => categoryForPortfolio(portfolio.slug) === category.id)
    }))
    .filter((group) => group.portfolios.length > 0);

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {groups.map(({ category, portfolios }) => (
        <section
          key={category.id}
          className="rounded-lg border border-border/70 bg-background/60 p-3"
        >
          <h3 className="flex items-center gap-2 px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: category.color }} />
            {category.label}
          </h3>
          <ul className="mt-2 space-y-0.5">
            {portfolios.map((portfolio) => {
              const latest = latestByPortfolio.get(portfolio.slug);
              return (
                <li key={portfolio.slug}>
                  <Link
                    href={`/${region}/${portfolio.slug}`}
                    className="flex min-h-[40px] items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    <span className="min-w-0 truncate">{portfolio.label}</span>
                    {latest?.signalLevel ? (
                      <SignalBadge level={latest.signalLevel} />
                    ) : (
                      <span className="shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground/50">—</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
