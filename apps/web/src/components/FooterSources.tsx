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
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
        </svg>
        <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Sources & Citations</h4>
      </div>
      
      <div className="grid gap-2 sm:grid-cols-2">
        {normalizedSources.map((s, i) => (
          <a
            key={s}
            href={s}
            target="_blank"
            rel="noreferrer"
            className="group flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3 text-sm transition-all hover:border-primary/30 hover:bg-muted/50"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">
              {i + 1}
            </span>
            <span className="flex-1 truncate text-foreground group-hover:text-primary">
              {getDomain(s)}
            </span>
            <svg className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
          </a>
        ))}
      </div>
    </div>
  );
}
