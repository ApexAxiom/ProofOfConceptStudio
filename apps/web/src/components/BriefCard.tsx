import { BriefPost, portfolioLabel, regionLabel } from "@proof/shared";
import { FooterSources } from "./FooterSources";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import rehypeExternalLinks from "rehype-external-links";

export function BriefCard({ brief }: { brief: BriefPost }) {
  return (
    <article className="bg-white p-4 rounded shadow-sm border flex flex-col gap-3">
      <div className="overflow-hidden rounded">
        <img
          src={brief.heroImageUrl ?? "/placeholder.svg"}
          alt={brief.heroImageAlt ?? brief.title}
          className="w-full h-40 object-cover"
          loading="lazy"
        />
      </div>
      <header className="flex justify-between items-start gap-2">
        <div>
          <h3 className="text-lg font-semibold">{brief.title}</h3>
          <p className="text-xs text-gray-600">
            {regionLabel(brief.region)} · {portfolioLabel(brief.portfolio)} · {brief.runWindow.toUpperCase()}
          </p>
        </div>
        <span className="text-xs text-gray-500">{new Date(brief.publishedAt).toLocaleString()}</span>
      </header>
      <ReactMarkdown
        className="prose max-w-none whitespace-pre-wrap text-sm"
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
    </article>
  );
}
