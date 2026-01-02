import { SelectedArticle } from "@proof/shared";
import { ProxiedImage } from "./ProxiedImage";
import { extractValidUrl } from "../lib/url";

interface ArticleCardProps {
  article: SelectedArticle;
  index: number;
}

/**
 * Executive-style article card with premium styling
 */
export function ArticleCard({ article, index }: ArticleCardProps) {
  const sourceUrl = extractValidUrl(article.url);
  const imageUrl = extractValidUrl(article.imageUrl);

  return (
    <div
      id={`article-${index + 1}`}
      className="group rounded-xl border border-border bg-card overflow-hidden transition-all duration-300 hover:border-primary/30"
      style={{
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.12)"
      }}
    >
      {/* Article Header with Image */}
      <div className="flex">
        {/* Left: Number Badge + Content */}
        <div className="flex-1 p-5 space-y-4">
          {/* Header Row */}
          <div className="flex items-start gap-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/80 text-sm font-bold text-primary-foreground flex-shrink-0 shadow-glow">
              {index + 1}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                {article.sourceName && (
                  <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                    {article.sourceName}
                  </span>
                )}
                {article.publishedAt && (
                  <span className="text-xs font-mono text-muted-foreground">
                    {new Date(article.publishedAt).toLocaleDateString("en-US", { 
                      month: "short", 
                      day: "numeric" 
                    })}
                  </span>
                )}
              </div>
              <h4 className="font-display text-base font-semibold leading-snug text-foreground group-hover:text-primary transition-colors">
                {article.title}
              </h4>
            </div>
          </div>
          
          {/* Key Metrics Strip */}
          {article.keyMetrics && article.keyMetrics.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {article.keyMetrics.map((metric, idx) => (
                <span 
                  key={idx} 
                  className="inline-flex items-center rounded-md bg-primary/10 border border-primary/20 px-2.5 py-1 text-xs font-semibold text-primary"
                >
                  {metric}
                </span>
              ))}
            </div>
          )}
          
          {/* Brief Content */}
          <p className="text-sm leading-relaxed text-muted-foreground">
            {article.briefContent}
          </p>
          
          {/* Category Importance Callout - Premium styling */}
          {article.categoryImportance && (
            <div className="rounded-lg border-l-2 border-primary bg-primary/5 px-4 py-3">
              <div className="flex items-start gap-3">
                <svg className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-primary">
                    Why This Matters
                  </span>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {article.categoryImportance}
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* Source Link */}
          {sourceUrl && (
            <div className="pt-2">
              <a
                href={sourceUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-secondary/50 px-4 py-2 text-sm font-medium text-foreground transition-all duration-200 hover:bg-secondary hover:border-primary/30 hover:text-primary group/link"
              >
                <svg className="h-4 w-4 transition-transform group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
                Read Full Article
              </a>
            </div>
          )}
        </div>
        
        {/* Right: Article Image */}
        {imageUrl && (
          <div className="hidden lg:block flex-shrink-0 w-52">
            <div className="h-full overflow-hidden bg-secondary">
              <ProxiedImage
                src={imageUrl}
                alt={article.imageAlt || article.title}
                className="h-full w-full object-cover transition-all duration-500 group-hover:scale-105"
                loading="lazy"
                style={{ filter: "brightness(0.95)" }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface ArticleListProps {
  articles: SelectedArticle[];
}

/**
 * Executive-style list of selected articles
 */
export function ArticleList({ articles }: ArticleListProps) {
  if (!articles || articles.length === 0) {
    return null;
  }
  
  return (
    <div className="space-y-6">
      {/* Section header with editorial styling */}
      <div className="section-divider">
        <h2 className="flex items-center gap-2">
          <svg className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z" />
          </svg>
          Key Intelligence
        </h2>
      </div>
      
      <div className="space-y-4">
        {articles.map((article, index) => (
          <ArticleCard key={article.url || index} article={article} index={index} />
        ))}
      </div>
    </div>
  );
}
