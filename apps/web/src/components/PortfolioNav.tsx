import Link from "next/link";
import { PORTFOLIOS, RegionSlug } from "@proof/shared";
import { categoryForPortfolio, CATEGORY_META } from "@proof/shared";

export function PortfolioNav({ region, activePortfolio }: { region: RegionSlug; activePortfolio?: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {PORTFOLIOS.map((p) => {
        const category = categoryForPortfolio(p.slug);
        const meta = CATEGORY_META[category];
        const isActive = activePortfolio === p.slug;
        
        return (
          <Link
            key={p.slug}
            href={`/${region}/${p.slug}`}
            className={`group flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-all duration-200 ${
              isActive
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-background text-muted-foreground hover:border-primary/30 hover:bg-muted hover:text-foreground"
            }`}
          >
            <span 
              className={`h-2 w-2 rounded-full transition-opacity ${isActive ? "" : "opacity-60 group-hover:opacity-100"}`}
              style={{ backgroundColor: meta.color }}
            />
            <span className="whitespace-nowrap">{p.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
