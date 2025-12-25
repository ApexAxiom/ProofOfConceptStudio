import Link from "next/link";
import { BriefPost, portfolioLabel, regionLabel } from "@proof/shared";

function previewText(brief: BriefPost): string {
  if (brief.summary) return brief.summary;
  const lines = brief.bodyMarkdown?.split(/\r?\n/) ?? [];
  const firstLine = lines.find((line) => line.trim() && !line.startsWith("#")) ?? "";
  return firstLine.replace(/^\*\*Overview:\*\*\s*/i, "").trim();
}

function truncate(text: string, max = 180): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max).trim()}…`;
}

function getCategoryColor(portfolio: string): string {
  if (portfolio.includes("drill") || portfolio.includes("rig") || portfolio.includes("wells") || portfolio.includes("complet") || portfolio.includes("subsea") || portfolio.includes("project") || portfolio.includes("equipment") || portfolio.includes("decom")) {
    return "energy";
  }
  if (portfolio.includes("logistics") || portfolio.includes("marine") || portfolio.includes("aviation")) {
    return "freight";
  }
  if (portfolio.includes("cyber") || portfolio.includes("it") || portfolio.includes("telecom")) {
    return "cyber";
  }
  if (portfolio.includes("services") || portfolio.includes("hr") || portfolio.includes("professional")) {
    return "services";
  }
  if (portfolio.includes("facility") || portfolio.includes("site")) {
    return "facility";
  }
  if (portfolio.includes("mro") || portfolio.includes("materials")) {
    return "steel";
  }
  return "energy";
}

const badgeClasses: Record<string, string> = {
  energy: "badge-energy",
  steel: "badge-steel",
  freight: "badge-freight",
  services: "badge-services",
  cyber: "badge-cyber",
  facility: "badge-facility"
};

function TimeAgo({ date }: { date: string }) {
  const now = new Date();
  const published = new Date(date);
  const diffMs = now.getTime() - published.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  
  let timeStr: string;
  if (diffHours < 1) {
    timeStr = "Just now";
  } else if (diffHours < 24) {
    timeStr = `${diffHours}h ago`;
  } else if (diffDays === 1) {
    timeStr = "Yesterday";
  } else if (diffDays < 7) {
    timeStr = `${diffDays}d ago`;
  } else {
    timeStr = published.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  
  return (
    <span className="flex items-center gap-1.5 text-xs text-slate-400">
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      {timeStr}
    </span>
  );
}

export function BriefCard({ brief }: { brief: BriefPost }) {
  const summary = truncate(previewText(brief) || brief.title);
  const sourceUrl = brief.heroImageSourceUrl || brief.sources?.[0];
  const categoryColor = getCategoryColor(brief.portfolio);
  const badgeClass = badgeClasses[categoryColor];
  const heroImageUrl = brief.heroImageUrl?.trim() || "/placeholder.svg";
  const heroImageAlt = brief.heroImageAlt?.trim() || brief.title;

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-900/90 to-slate-950/90 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:border-slate-600/50 hover:shadow-xl hover:shadow-blue-500/5">
      {/* Hero Image */}
      <div className="relative h-48 w-full overflow-hidden">
        <img
          src={heroImageUrl}
          alt={heroImageAlt}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent" />
        
        {/* Run window badge */}
        <div className="absolute right-3 top-3">
          <span className="rounded-full bg-slate-900/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-300 backdrop-blur-sm">
            {brief.runWindow}
          </span>
        </div>
        
        {/* Bottom tags */}
        <div className="absolute bottom-3 left-3 flex flex-wrap gap-2">
          <span className={`badge ${badgeClass}`}>
            {portfolioLabel(brief.portfolio)}
          </span>
          <span className="badge bg-slate-800/80 text-slate-300 border border-slate-600/50">
            {regionLabel(brief.region)}
          </span>
        </div>
      </div>
      
      {/* Content */}
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex-1 space-y-3">
          <div className="flex items-center justify-between">
            <TimeAgo date={brief.publishedAt} />
            <div className="flex items-center gap-1.5">
              <span className="status-dot live" />
              <span className="text-[10px] font-medium uppercase tracking-wider text-emerald-400">Live</span>
            </div>
          </div>
          
          <h3 className="text-lg font-semibold leading-snug text-white transition-colors group-hover:text-blue-300">
            {brief.title}
          </h3>
          
          <p className="text-sm leading-relaxed text-slate-400">
            {summary}
          </p>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-3 border-t border-slate-700/50 pt-4">
          <Link
            href={`/brief/${brief.postId}`}
            className="btn-primary flex-1 justify-center text-sm"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v16.5c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9zm3.75 11.625a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
            Open Brief
          </Link>
          {sourceUrl && (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary px-3 text-sm"
              title="View source article"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            </a>
          )}
        </div>
      </div>

      {/* Subtle glow effect on hover */}
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ boxShadow: "inset 0 0 60px rgba(59, 130, 246, 0.03)" }}
        aria-hidden="true"
      />
    </article>
  );
}
