import Link from "next/link";
import { BriefPost, portfolioLabel, regionLabel } from "@proof/shared";

function previewText(brief: BriefPost): string {
  if (brief.summary) return brief.summary;
  const lines = brief.bodyMarkdown?.split(/\r?\n/) ?? [];
  const firstLine = lines.find((line) => line.trim() && !line.startsWith("#")) ?? "";
  return firstLine.replace(/^\*\*Overview:\*\*\s*/i, "").trim();
}

function truncate(text: string, max = 220): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max).trim()}…`;
}

export function BriefCard({ brief }: { brief: BriefPost }) {
  const summary = truncate(previewText(brief) || brief.title);
  const sourceUrl = brief.heroImageSourceUrl || brief.sources?.[0];
  return (
    <article className="overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md flex flex-col">
      <div className="relative h-44 w-full overflow-hidden">
        <img
          src={brief.heroImageUrl ?? "/placeholder.svg"}
          alt={brief.heroImageAlt ?? brief.title}
          className="h-full w-full object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-slate-900/10 to-transparent" />
        <div className="absolute bottom-3 left-3 flex gap-2 text-[11px] font-semibold text-white">
          <span className="rounded-full bg-white/20 px-2 py-1 backdrop-blur">{regionLabel(brief.region)}</span>
          <span className="rounded-full bg-white/20 px-2 py-1 backdrop-blur">{portfolioLabel(brief.portfolio)}</span>
          <span className="rounded-full bg-white/20 px-2 py-1 backdrop-blur">{brief.runWindow.toUpperCase()}</span>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="space-y-2">
          <p className="text-xs text-slate-500">{new Date(brief.publishedAt).toLocaleString()}</p>
          <h3 className="text-lg font-semibold text-slate-900">{brief.title}</h3>
          <p className="text-sm text-slate-700 leading-relaxed">{summary}</p>
        </div>
        <div className="mt-auto flex flex-wrap gap-2 text-sm">
          <Link
            href={`/brief/${brief.postId}`}
            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-slate-800"
          >
            Open brief
          </Link>
          {sourceUrl ? (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 font-semibold text-slate-800 hover:border-slate-400"
            >
              Read source
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}
