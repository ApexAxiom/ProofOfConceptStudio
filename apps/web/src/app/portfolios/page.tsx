import Link from "next/link";
import { CATEGORY_META, PORTFOLIOS, categoryForPortfolio } from "@proof/shared";

/**
 * Portfolio directory landing page.
 */
export default function PortfoliosPage() {
  const groupedPortfolios = Object.values(CATEGORY_META).map((category) => ({
    category,
    portfolios: PORTFOLIOS.filter((portfolio) => categoryForPortfolio(portfolio.slug) === category.id)
  }));

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">My Portfolios</p>
        <h1 className="text-2xl font-semibold text-foreground">Portfolio workbenches</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Select a portfolio to review the latest signals, recommended actions, and daily briefs.
        </p>
      </div>

      <div className="grid gap-6">
        {groupedPortfolios.map(({ category, portfolios }) => (
          <section key={category.id} className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4 flex items-center gap-3">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: category.color }} />
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                {category.label}
              </h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {portfolios.map((portfolio) => (
                <Link
                  key={portfolio.slug}
                  href={`/portfolio/${portfolio.slug}`}
                  className="rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground transition hover:border-primary/40"
                >
                  <p className="font-semibold">{portfolio.label}</p>
                  {portfolio.description && (
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                      {portfolio.description}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
