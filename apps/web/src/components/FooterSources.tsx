import { extractValidUrl } from "../lib/url";

export function FooterSources({ sources }: { sources?: string[] }) {
  const normalizedSources = (sources ?? [])
    .map((source) => extractValidUrl(source))
    .filter((s): s is string => Boolean(s));

  if (!normalizedSources.length) return null;
  
  // Extract domain from URL for display
  function getDomain(url: string): string {
    try {
      const domain = new URL(url).hostname.replace(/^www\./, "");
      return domain;
    } catch {
      return url;
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="accent-line" />
        <h4 className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">Sources & Citations</h4>
      </div>
      
      <div className="grid gap-2 sm:grid-cols-2">
        {normalizedSources.map((s, i) => (
          <a
            key={s}
            href={s}
            target="_blank"
            rel="noreferrer"
            className="group flex items-center gap-3 rounded-lg border border-border bg-secondary/30 p-3 text-sm transition-all duration-200 hover:border-primary/30 hover:bg-secondary"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 text-xs font-bold text-primary">
              {i + 1}
            </span>
            <span className="flex-1 truncate text-foreground font-medium group-hover:text-primary transition-colors">
              {getDomain(s)}
            </span>
            <svg className="h-4 w-4 shrink-0 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
          </a>
        ))}
      </div>
    </div>
  );
}
