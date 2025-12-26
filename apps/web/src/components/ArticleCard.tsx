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
    <div className="group rounded-lg border border-border bg-card p-4 transition-all duration-200 hover:shadow-sm">
      <div className="flex gap-4">
        {/* Article Image */}
        {imageUrl && (
          <div className="hidden sm:block flex-shrink-0">
            <div className="h-20 w-28 overflow-hidden rounded-md bg-muted">
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
        <div className="flex-1 space-y-2">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {index + 1}
              </span>
              {article.sourceName && (
                <span className="text-xs font-medium text-muted-foreground">
                  {article.sourceName}
                </span>
              )}
            </div>
          </div>
          
          {/* Title */}
          <h4 className="text-sm font-semibold leading-snug text-foreground">
            {article.title}
          </h4>
          
          {/* Brief Content */}
          <p className="text-sm leading-relaxed text-muted-foreground line-clamp-2">
            {article.briefContent}
          </p>
          
          {/* Source Link */}
          {sourceUrl && (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-muted/80"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
              Read Full Article
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
      <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
        <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z" />
        </svg>
        Featured Articles
      </h2>
      <div className="space-y-3">
        {articles.map((article, index) => (
          <ArticleCard key={article.url || index} article={article} index={index} />
        ))}
      </div>
    </div>
  );
}
