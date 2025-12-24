import Link from "next/link";
import { RegionTabs } from "../components/RegionTabs";
import { BriefCard } from "../components/BriefCard";
import { REGION_LIST, REGIONS, PORTFOLIOS } from "@proof/shared";
import { fetchLatestByPortfolio } from "../lib/api";

// Portfolio category icons
function getPortfolioIcon(slug: string) {
  const icons: Record<string, JSX.Element> = {
    "rigs-integrated-drilling": (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v16.5c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9zm3.75 11.625a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
    "drilling-services": (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
      </svg>
    ),
    "wells-materials-octg": (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
      </svg>
    ),
    "subsea-surf-offshore": (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
      </svg>
    ),
    "it-telecom-cyber": (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
    "logistics-marine-aviation": (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
      </svg>
    ),
    "site-services-facilities": (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
      </svg>
    ),
    "professional-services-hr": (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    )
  };
  
  return icons[slug] || (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  );
}

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

function PortfolioCard({ portfolio, region, brief }: { portfolio: { slug: string; label: string; description: string }; region: string; brief?: { postId: string; title: string; publishedAt: string } }) {
  const color = getCategoryColor(portfolio.slug);
  const colorClasses: Record<string, { bg: string; border: string; text: string; glow: string }> = {
    energy: { bg: "bg-amber-500/10", border: "border-amber-500/30", text: "text-amber-400", glow: "shadow-amber-500/10" },
    steel: { bg: "bg-slate-400/10", border: "border-slate-400/30", text: "text-slate-300", glow: "shadow-slate-400/10" },
    freight: { bg: "bg-cyan-500/10", border: "border-cyan-500/30", text: "text-cyan-400", glow: "shadow-cyan-500/10" },
    services: { bg: "bg-violet-500/10", border: "border-violet-500/30", text: "text-violet-400", glow: "shadow-violet-500/10" },
    cyber: { bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-400", glow: "shadow-emerald-500/10" },
    facility: { bg: "bg-pink-500/10", border: "border-pink-500/30", text: "text-pink-400", glow: "shadow-pink-500/10" }
  };
  const c = colorClasses[color];

  return (
    <Link
      href={`/${region}/${portfolio.slug}`}
      className={`card group relative flex flex-col overflow-hidden rounded-2xl border ${c.border} bg-gradient-to-br from-slate-900/80 to-slate-950/80 p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${c.glow} hover:border-opacity-60`}
    >
      {/* Icon */}
      <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl ${c.bg} ${c.text}`}>
        {getPortfolioIcon(portfolio.slug)}
      </div>
      
      {/* Content */}
      <div className="flex-1">
        <h3 className="mb-1 text-base font-semibold text-white group-hover:text-blue-300 transition-colors">
          {portfolio.label}
        </h3>
        <p className="text-sm text-slate-400 line-clamp-2">
          {portfolio.description}
        </p>
      </div>
      
      {/* Latest brief indicator */}
      {brief ? (
        <div className="mt-4 border-t border-slate-700/50 pt-4">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="status-dot live" />
            <span>Latest brief</span>
          </div>
          <p className="mt-1.5 text-sm font-medium text-slate-300 line-clamp-1">{brief.title}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {new Date(brief.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
      ) : (
        <div className="mt-4 border-t border-slate-700/50 pt-4">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="status-dot pending" />
            <span>Awaiting first brief</span>
          </div>
        </div>
      )}
      
      {/* Hover arrow */}
      <div className="absolute right-4 top-4 text-slate-600 transition-all group-hover:translate-x-1 group-hover:text-blue-400">
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
        </svg>
      </div>
    </Link>
  );
}

function StatsCard({ label, value, change, icon }: { label: string; value: string; change?: string; icon: JSX.Element }) {
  const isPositive = change?.startsWith("+");
  return (
    <div className="stat-card">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</p>
          <p className="mt-1 text-2xl font-bold text-white">{value}</p>
          {change && (
            <p className={`mt-1 text-xs font-medium ${isPositive ? "text-emerald-400" : "text-slate-400"}`}>
              {change} from last week
            </p>
          )}
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
          {icon}
        </div>
      </div>
    </div>
  );
}

export default async function Home() {
  const region = REGION_LIST[0];
  const briefs = await fetchLatestByPortfolio(region.slug);
  
  // Map briefs by portfolio
  const briefsByPortfolio: Record<string, typeof briefs[0]> = {};
  for (const b of briefs) {
    briefsByPortfolio[b.portfolio] = b;
  }

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-700/50 bg-gradient-to-br from-slate-900 via-slate-800/80 to-slate-900 p-8 shadow-xl">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-violet-500/5 to-pink-500/5" />
        <div className="absolute -right-20 -top-20 h-60 w-60 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-60 w-60 rounded-full bg-violet-500/10 blur-3xl" />
        
        <div className="relative">
          <RegionTabs activeRegion={region.slug} />
          
          <div className="mt-6">
            <div className="flex items-center gap-3 text-sm font-medium text-blue-400">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
              <span>Intelligence Dashboard</span>
            </div>
            <h2 className="mt-2 text-3xl font-bold text-white md:text-4xl">
              {REGIONS[region.slug].label}
            </h2>
            <p className="mt-3 max-w-2xl text-base text-slate-300">
              Real-time category intelligence with AI-powered daily briefs. Click any portfolio to dive deep into market movements, supplier signals, and strategic insights.
            </p>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          label="Active Portfolios"
          value={String(PORTFOLIOS.length)}
          icon={<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6z" /></svg>}
        />
        <StatsCard
          label="Briefs Today"
          value={String(briefs.length)}
          change="+12%"
          icon={<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>}
        />
        <StatsCard
          label="Active Regions"
          value={String(REGION_LIST.length)}
          icon={<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" /></svg>}
        />
        <StatsCard
          label="Market Indices"
          value="47"
          icon={<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" /></svg>}
        />
      </div>

      {/* Portfolios Grid */}
      <div>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-white">Portfolio Categories</h3>
            <p className="mt-1 text-sm text-slate-400">Select a category to view the latest intelligence briefs</p>
          </div>
          <Link href="/chat" className="btn-secondary text-sm">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            Ask AI
          </Link>
        </div>
        
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {PORTFOLIOS.map((portfolio) => (
            <PortfolioCard
              key={portfolio.slug}
              portfolio={portfolio}
              region={region.slug}
              brief={briefsByPortfolio[portfolio.slug]}
            />
          ))}
        </div>
      </div>

      {/* Latest Briefs */}
      {briefs.length > 0 && (
        <div>
          <div className="mb-6">
            <h3 className="text-xl font-bold text-white">Latest Intelligence Briefs</h3>
            <p className="mt-1 text-sm text-slate-400">Most recent AI-generated briefs across all categories</p>
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {briefs.slice(0, 6).map((brief) => (
              <BriefCard key={brief.postId} brief={brief} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
