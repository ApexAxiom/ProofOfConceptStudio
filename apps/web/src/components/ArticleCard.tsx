import { SelectedArticle } from "@proof/shared";
import { ProxiedImage } from "./ProxiedImage";
import { extractValidUrl } from "../lib/url";

interface ArticleCardProps {
  article: SelectedArticle;
  index: number;
}

/**
 * Displays a selected article with its brief and source link
 */
export function ArticleCard({ article, index }: ArticleCardProps) {
  const sourceUrl = extractValidUrl(article.url);
  const imageUrl = extractValidUrl(article.imageUrl);
  
  return (
    <div className="group rounded-xl border border-slate-700/50 bg-slate-900/50 p-5 transition-all duration-200 hover:border-slate-600/50 hover:bg-slate-900/80">
      <div className="flex gap-4">
        {/* Article Image */}
        {imageUrl && (
          <div className="hidden sm:block flex-shrink-0">
            <div className="h-24 w-32 overflow-hidden rounded-lg">
              <ProxiedImage
                src={imageUrl}
                alt={article.imageAlt || article.title}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
              />
            </div>
          </div>
        )}
        
        {/* Article Content */}
        <div className="flex-1 space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500/20 text-xs font-bold text-blue-400">
                {index + 1}
              </span>
              {article.sourceName && (
                <span className="text-xs font-medium text-slate-500">
                  {article.sourceName}
                </span>
              )}
            </div>
          </div>
          
          {/* Title */}
          <h4 className="text-base font-semibold leading-snug text-white">
            {article.title}
          </h4>
          
          {/* Brief Content */}
          <p className="text-sm leading-relaxed text-slate-400">
            {article.briefContent}
          </p>
          
          {/* Source Link */}
          {sourceUrl && (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-2 rounded-lg bg-slate-800/50 px-3 py-2 text-sm font-medium text-blue-400 transition-colors hover:bg-slate-800 hover:text-blue-300"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
              Read Full Article
              <span className="text-xs text-slate-500">↗</span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

interface ArticleListProps {
  articles: SelectedArticle[];
}

/**
 * Displays a list of selected articles
 */
export function ArticleList({ articles }: ArticleListProps) {
  if (!articles || articles.length === 0) {
    return null;
  }
  
  return (
    <div className="space-y-4">
      <h2 className="flex items-center gap-2 text-xl font-bold text-white">
        <svg className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z" />
        </svg>
        Featured Articles
      </h2>
      <div className="space-y-4">
        {articles.map((article, index) => (
          <ArticleCard key={article.url || index} article={article} index={index} />
        ))}
      </div>
    </div>
  );
}
