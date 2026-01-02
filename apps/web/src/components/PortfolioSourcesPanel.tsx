import { getPortfolioSources, PortfolioSource } from "@proof/shared";

interface PortfolioSourcesPanelProps {
  portfolio: string;
  regionKey: "apac" | "intl";
}

function SourceCard({ source }: { source: PortfolioSource }) {
  const regionLabel = source.region === "apac" ? "🌏 APAC" : source.region === "intl" ? "🌎 INTL" : "🌐 Global";
  
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-border bg-card hover:bg-secondary/50 hover:border-primary/30 transition-all duration-200 text-sm"
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-xs text-muted-foreground">{regionLabel}</span>
        <span className="font-medium text-foreground truncate group-hover:text-primary transition-colors">{source.name}</span>
      </div>
      <svg className="h-4 w-4 text-muted-foreground group-hover:text-primary flex-shrink-0 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
      </svg>
    </a>
  );
}

export function PortfolioSourcesPanel({ portfolio, regionKey }: PortfolioSourcesPanelProps) {
  const allSources = getPortfolioSources(portfolio);
  const globalSources = allSources.filter(s => s.region === "both");
  const regionalSources = getPortfolioSources(portfolio, regionKey);

  const regionEmoji = regionKey === "apac" ? "🌏" : "🌎";
  const regionTitle = regionKey === "apac" ? "APAC" : "International";

  const combinedSources = [...globalSources, ...regionalSources];

  if (combinedSources.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-secondary mx-auto mb-4 flex items-center justify-center">
          <svg className="h-6 w-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
          </svg>
        </div>
        <h4 className="text-base font-semibold text-foreground mb-1">No sources configured</h4>
        <p className="text-sm text-muted-foreground">
          Intelligence sources for this portfolio have not been configured yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-xl">{regionEmoji}</span>
        <h3 className="text-sm font-semibold text-foreground">{regionTitle} Sources</h3>
        <span className="text-xs font-mono text-muted-foreground">({combinedSources.length})</span>
      </div>
      
      <div className="space-y-2">
        {combinedSources.map((source) => (
          <SourceCard key={source.url} source={source} />
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        These sources are monitored daily to generate intelligence briefs for this portfolio.
      </p>
    </div>
  );
}
