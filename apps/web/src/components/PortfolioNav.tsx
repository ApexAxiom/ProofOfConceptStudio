import Link from "next/link";
import { PORTFOLIOS } from "@proof/shared";
import { RegionSlug } from "@proof/shared";

function getCategoryColor(slug: string): string {
  if (slug.includes("drill") || slug.includes("rig") || slug.includes("wells") || slug.includes("complet") || slug.includes("subsea") || slug.includes("project") || slug.includes("equipment") || slug.includes("decom")) {
    return "energy";
  }
  if (slug.includes("logistics") || slug.includes("marine") || slug.includes("aviation")) {
    return "freight";
  }
  if (slug.includes("cyber") || slug.includes("it") || slug.includes("telecom")) {
    return "cyber";
  }
  if (slug.includes("services") || slug.includes("hr") || slug.includes("professional")) {
    return "services";
  }
  if (slug.includes("facility") || slug.includes("site")) {
    return "facility";
  }
  if (slug.includes("mro") || slug.includes("materials")) {
    return "steel";
  }
  return "energy";
}

const colorConfig: Record<string, { active: string; inactive: string; dot: string }> = {
  energy: {
    active: "bg-amber-500/20 border-amber-500/50 text-amber-300",
    inactive: "border-amber-500/20 text-amber-400/70 hover:border-amber-500/40 hover:bg-amber-500/5",
    dot: "bg-amber-400"
  },
  steel: {
    active: "bg-slate-500/20 border-slate-400/50 text-slate-200",
    inactive: "border-slate-500/20 text-slate-400 hover:border-slate-400/40 hover:bg-slate-500/5",
    dot: "bg-slate-400"
  },
  freight: {
    active: "bg-cyan-500/20 border-cyan-500/50 text-cyan-300",
    inactive: "border-cyan-500/20 text-cyan-400/70 hover:border-cyan-500/40 hover:bg-cyan-500/5",
    dot: "bg-cyan-400"
  },
  services: {
    active: "bg-violet-500/20 border-violet-500/50 text-violet-300",
    inactive: "border-violet-500/20 text-violet-400/70 hover:border-violet-500/40 hover:bg-violet-500/5",
    dot: "bg-violet-400"
  },
  cyber: {
    active: "bg-emerald-500/20 border-emerald-500/50 text-emerald-300",
    inactive: "border-emerald-500/20 text-emerald-400/70 hover:border-emerald-500/40 hover:bg-emerald-500/5",
    dot: "bg-emerald-400"
  },
  facility: {
    active: "bg-pink-500/20 border-pink-500/50 text-pink-300",
    inactive: "border-pink-500/20 text-pink-400/70 hover:border-pink-500/40 hover:bg-pink-500/5",
    dot: "bg-pink-400"
  }
};

export function PortfolioNav({ region, activePortfolio }: { region: RegionSlug; activePortfolio?: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {PORTFOLIOS.map((p) => {
        const color = getCategoryColor(p.slug);
        const config = colorConfig[color];
        const isActive = activePortfolio === p.slug;
        
        return (
          <Link
            key={p.slug}
            href={`/${region}/${p.slug}`}
            className={`group flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200 ${
              isActive ? config.active : config.inactive
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${config.dot} ${isActive ? "" : "opacity-50 group-hover:opacity-100"}`} />
            <span className="whitespace-nowrap">{p.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
