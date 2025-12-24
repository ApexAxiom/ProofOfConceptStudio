import { RegionTabs } from "../../components/RegionTabs";
import { FooterSources } from "../../components/FooterSources";
import { fetchPost } from "../../lib/api";
import { portfolioLabel, regionLabel } from "@proof/shared";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import rehypeExternalLinks from "rehype-external-links";
import { notFound } from "next/navigation";

function previewText(markdown?: string, fallback?: string): string {
  if (!markdown) return fallback ?? "";
  const lines = markdown.split(/\r?\n/);
  const firstLine = lines.find((line) => line.trim() && !line.startsWith("#")) ?? fallback ?? "";
  return firstLine.replace(/^\*\*Overview:\*\*\s*/i, "").trim();
}

export default async function BriefDetailPage({ params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
  const brief = await fetchPost(postId);
  if (!brief) return notFound();

  const published = new Date(brief.publishedAt).toLocaleString();
  const sourceUrl = brief.heroImageSourceUrl || brief.sources?.[0];
  const overview = brief.summary ?? previewText(brief.bodyMarkdown, "This brief includes a short overview and quick takes.");

  return (
    <div className="space-y-6">
      <RegionTabs activeRegion={brief.region} />
      <article className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="relative h-64 w-full overflow-hidden">
          <img
            src={brief.heroImageUrl ?? "/placeholder.svg"}
            alt={brief.heroImageAlt ?? brief.title}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-slate-900/10 to-transparent" />
          <div className="absolute bottom-3 left-3 flex flex-wrap gap-2 text-xs font-semibold text-white">
            <span className="rounded-full bg-white/20 px-3 py-1 backdrop-blur">
              {regionLabel(brief.region)}
            </span>
            <span className="rounded-full bg-white/20 px-3 py-1 backdrop-blur">{portfolioLabel(brief.portfolio)}</span>
            <span className="rounded-full bg-white/20 px-3 py-1 backdrop-blur">{brief.runWindow.toUpperCase()}</span>
          </div>
        </div>
        <div className="space-y-4 p-6">
          <div className="flex items-center justify-between text-sm text-slate-600">
            <span>{published}</span>
            {sourceUrl ? (
              <a
                href={sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-slate-300 px-3 py-1.5 font-semibold text-slate-800 hover:border-slate-400"
              >
                Read source
              </a>
            ) : null}
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-slate-900">{brief.title}</h1>
            <p className="text-base text-slate-700">{overview}</p>
          </div>
          <ReactMarkdown
            className="prose max-w-none whitespace-pre-wrap text-base prose-a:text-blue-700"
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[
              rehypeSanitize,
              [
                rehypeExternalLinks,
                {
                  target: "_blank",
                  rel: ["noreferrer", "noopener"]
                }
              ]
            ]}
          >
            {brief.bodyMarkdown}
          </ReactMarkdown>
          <FooterSources sources={brief.sources} />
        </div>
      </article>
    </div>
  );
}
