import Link from "next/link";
import { PORTFOLIOS, REGION_LIST, RegionSlug, BriefPost } from "@proof/shared";
import { categoryForPortfolio, CATEGORY_META } from "@proof/shared";

interface CoverageMatrixProps {
  briefsByRegion: Record<RegionSlug, BriefPost[]>;
}

function getHoursSince(dateStr: string): number {
  const now = new Date();
  const date = new Date(dateStr);
  return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
}

function getFreshnessClass(hours: number | null): string {
  if (hours === null) return "text-muted-foreground bg-muted/50";
  if (hours < 6) return "text-emerald-700 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-500/20";
  if (hours <= 24) return "text-amber-700 bg-amber-100 dark:text-amber-400 dark:bg-amber-500/20";
  return "text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-500/20";
}

function formatFreshness(hours: number | null): string {
  if (hours === null) return "—";
  if (hours < 1) return "<1h";
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function CoverageMatrix({ briefsByRegion }: CoverageMatrixProps) {
  const coverage: Record<string, Record<RegionSlug, BriefPost | null>> = {};
  
  for (const portfolio of PORTFOLIOS) {
    coverage[portfolio.slug] = {} as Record<RegionSlug, BriefPost | null>;
    for (const region of REGION_LIST) {
      const briefs = briefsByRegion[region.slug] || [];
      const match = briefs.find(b => b.portfolio === portfolio.slug);
      coverage[portfolio.slug][region.slug] = match || null;
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Portfolio Coverage</h2>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Fresh
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            Recent
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            Old
          </span>
        </div>
      </div>
      
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="sticky left-0 z-10 bg-muted/30 px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                  Category
                </th>
                {REGION_LIST.map(region => (
                  <th key={region.slug} className="px-3 py-2 text-center text-xs font-medium text-muted-foreground whitespace-nowrap">
                    {region.slug === "au" ? "🇦🇺 AU" : "🇺🇸 US"}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PORTFOLIOS.map((portfolio) => {
                const category = categoryForPortfolio(portfolio.slug);
                const meta = CATEGORY_META[category];
                
                return (
                  <tr key={portfolio.slug} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="sticky left-0 z-10 bg-card px-3 py-2">
                      <Link 
                        href={`/portfolio/${portfolio.slug}`}
                        className="flex items-center gap-2 text-sm hover:text-primary transition-colors"
                      >
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: meta.color }} />
                        <span className="truncate max-w-[180px] text-foreground" title={portfolio.label}>
                          {portfolio.label}
                        </span>
                      </Link>
                    </td>
                    {REGION_LIST.map(region => {
                      const brief = coverage[portfolio.slug][region.slug];
                      const hours = brief ? getHoursSince(brief.publishedAt) : null;
                      const freshnessClass = getFreshnessClass(hours);
                      const freshnessText = formatFreshness(hours);
                      
                      return (
                        <td key={region.slug} className="px-3 py-2 text-center">
                          {brief ? (
                            <Link
                              href={`/${region.slug}/${portfolio.slug}`}
                              className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${freshnessClass} hover:opacity-80 transition-opacity`}
                              title={`Updated: ${new Date(brief.publishedAt).toLocaleString()}`}
                            >
                              {freshnessText}
                            </Link>
                          ) : (
                            <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${freshnessClass}`}>
                              {freshnessText}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
