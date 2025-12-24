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
          className={`rounded-full border px-3 py-2 font-semibold transition ${
            activePortfolio === p.slug
              ? "border-slate-900 bg-slate-900 text-white shadow"
              : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
          }`}
        >
          {p.label}
        </Link>
      ))}
    </div>
  );
}
