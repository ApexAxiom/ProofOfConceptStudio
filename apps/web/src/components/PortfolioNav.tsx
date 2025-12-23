import Link from "next/link";
import { PORTFOLIOS } from "@proof/shared";
import { RegionSlug } from "@proof/shared";

export function PortfolioNav({ region, activePortfolio }: { region: RegionSlug; activePortfolio?: string }) {
  return (
    <div className="flex flex-wrap gap-2 text-sm">
      {PORTFOLIOS.map((p) => (
        <Link
          key={p.slug}
          href={`/${region}/${p.slug}`}
          className={`px-3 py-2 rounded border ${activePortfolio === p.slug ? "bg-blue-100 border-blue-500" : "bg-white"}`}
        >
          {p.label}
        </Link>
      ))}
    </div>
  );
}
