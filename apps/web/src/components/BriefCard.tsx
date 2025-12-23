import { BriefPost, portfolioLabel, regionLabel } from "@proof/shared";
import { FooterSources } from "./FooterSources";

export function BriefCard({ brief }: { brief: BriefPost }) {
  return (
    <article className="bg-white p-4 rounded shadow-sm border flex flex-col gap-2">
      <header className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">{brief.title}</h3>
          <p className="text-xs text-gray-600">
            {regionLabel(brief.region)} · {portfolioLabel(brief.portfolio)} · {brief.runWindow.toUpperCase()}
          </p>
        </div>
        <span className="text-xs text-gray-500">{new Date(brief.publishedAt).toLocaleString()}</span>
      </header>
      <div className="prose max-w-none whitespace-pre-wrap text-sm" dangerouslySetInnerHTML={{ __html: brief.bodyMarkdown }} />
      <FooterSources sources={brief.sources} />
    </article>
  );
}
