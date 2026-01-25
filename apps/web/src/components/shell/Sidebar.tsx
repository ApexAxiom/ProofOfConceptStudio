"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { CATEGORY_META, PORTFOLIOS, categoryForPortfolio } from "@proof/shared";

/**
 * Displays the portfolio navigation grouped by category with quick filtering.
 */
export function Sidebar() {
  const pathname = usePathname();
  const [query, setQuery] = useState("");

  const groupedPortfolios = useMemo(() => {
    const filtered = PORTFOLIOS.filter((portfolio) =>
      portfolio.label.toLowerCase().includes(query.toLowerCase())
    );

    return Object.values(CATEGORY_META).map((category) => {
      const portfolios = filtered.filter(
        (portfolio) => categoryForPortfolio(portfolio.slug) === category.id
      );
      return { category, portfolios };
    });
  }, [query]);

  return (
    <aside className="sticky top-16 hidden h-[calc(100vh-64px)] w-72 shrink-0 border-r border-border bg-card/40 p-5 md:block">
      <div className="flex h-full flex-col gap-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Portfolios</p>
          <input
            type="search"
            placeholder="Search portfolios"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            aria-label="Search portfolios"
          />
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto pr-1">
          {groupedPortfolios.map(({ category, portfolios }) => (
            <details key={category.id} className="rounded-lg border border-border/70 bg-background/60" open>
              <summary className="cursor-pointer list-none px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: category.color }} />
                  {category.label}
                </span>
              </summary>
              <div className="space-y-1 px-2 pb-3">
                {portfolios.length === 0 && (
                  <p className="px-2 text-xs text-muted-foreground">No matches.</p>
                )}
                {portfolios.map((portfolio) => {
                  const href = `/portfolio/${portfolio.slug}`;
                  const active = pathname === href;
                  return (
                    <Link
                      key={portfolio.slug}
                      href={href}
                      className={`flex items-center justify-between rounded-md px-2 py-2 text-sm transition-colors ${
                        active
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span className="truncate">{portfolio.label}</span>
                      {active && (
                        <span className="text-[10px] font-semibold uppercase tracking-[0.18em]">Active</span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </details>
          ))}
        </div>

        <div className="rounded-lg border border-border bg-background/80 p-3 text-xs text-muted-foreground">
          Tip: Select a portfolio to open the workbench and briefing history.
        </div>
      </div>
    </aside>
  );
}
