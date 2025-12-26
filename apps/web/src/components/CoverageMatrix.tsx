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
  if (hours === null) return "freshness-none";
  if (hours < 6) return "freshness-fresh";
  if (hours <= 24) return "freshness-stale";
  return "freshness-old";
}

function formatFreshness(hours: number | null): string {
  if (hours === null) return "—";
  if (hours < 1) return "<1h";
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function CoverageMatrix({ briefsByRegion }: CoverageMatrixProps) {
  // Create a lookup: portfolio slug -> region -> latest brief
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
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="border-b border-border bg-muted/30 px-4 py-3">
        <h3 className="font-semibold text-foreground">Coverage Matrix</h3>
        <p className="text-sm text-muted-foreground">Portfolio freshness across regions • Click to view details</p>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/20">
              <th className="sticky left-0 z-10 bg-muted/30 px-4 py-3 text-left font-medium text-muted-foreground">
                Portfolio
              </th>
              {REGION_LIST.map(region => (
                <th key={region.slug} className="px-4 py-3 text-center font-medium text-muted-foreground whitespace-nowrap">
                  <span className="mr-1.5">{region.slug === "au" ? "🇦🇺" : "🇺🇸"}</span>
                  {region.label.split(" ")[0]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PORTFOLIOS.map((portfolio) => {
              const category = categoryForPortfolio(portfolio.slug);
              const meta = CATEGORY_META[category];
              
              return (
                <tr key={portfolio.slug} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="sticky left-0 z-10 bg-card px-4 py-2.5 font-medium text-foreground">
                    <div className="flex items-center gap-2">
                      <span 
                        className="h-2 w-2 rounded-full" 
                        style={{ backgroundColor: meta.color }}
                      />
                      <span className="truncate max-w-[200px]" title={portfolio.label}>
                        {portfolio.label}
                      </span>
                    </div>
                  </td>
                  {REGION_LIST.map(region => {
                    const brief = coverage[portfolio.slug][region.slug];
                    const hours = brief ? getHoursSince(brief.publishedAt) : null;
                    const freshnessClass = getFreshnessClass(hours);
                    const freshnessText = formatFreshness(hours);
                    
                    return (
                      <td key={region.slug} className="px-4 py-2.5 text-center">
                        {brief ? (
                          <Link
                            href={`/${region.slug}/${portfolio.slug}`}
                            className={`inline-flex items-center justify-center rounded-md px-2.5 py-1 text-xs font-medium transition-all hover:scale-105 ${freshnessClass}`}
                            title={`Last updated: ${new Date(brief.publishedAt).toLocaleString()}`}
                          >
                            {freshnessText}
                          </Link>
                        ) : (
                          <span className={`inline-flex items-center justify-center rounded-md px-2.5 py-1 text-xs font-medium ${freshnessClass}`}>
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
      
      <div className="border-t border-border bg-muted/20 px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm freshness-fresh" />
            Fresh (&lt;6h)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm freshness-stale" />
            Stale (6-24h)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm freshness-old" />
            Old (&gt;24h)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm freshness-none" />
            No coverage
          </span>
        </div>
      </div>
    </div>
  );
}
