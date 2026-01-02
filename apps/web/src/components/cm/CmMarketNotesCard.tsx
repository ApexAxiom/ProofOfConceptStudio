import { BriefPost } from "@proof/shared";

interface CmMarketNotesCardProps {
  brief?: BriefPost;
}

const DEFAULT_VISIBLE = 3;

export function CmMarketNotesCard({ brief }: CmMarketNotesCardProps) {
  const marketIndicators = brief?.marketIndicators ?? [];

  const visibleIndicators = marketIndicators.slice(0, DEFAULT_VISIBLE);
  const hiddenIndicators = marketIndicators.slice(DEFAULT_VISIBLE);

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200">
          📈
        </span>
        <span>Market notes</span>
      </div>

      {marketIndicators.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No data yet. This will populate after the next brief run.
        </p>
      )}

      {marketIndicators.length > 0 && (
        <div className="space-y-2 text-sm">
          {visibleIndicators.map((indicator) => (
            <div key={indicator.id} className="rounded-md border border-border bg-background p-3">
              <p className="font-semibold text-foreground">{indicator.label}</p>
              <p className="text-muted-foreground">{indicator.note}</p>
            </div>
          ))}

          {hiddenIndicators.length > 0 && (
            <details className="group">
              <summary className="text-xs text-primary cursor-pointer hover:underline list-none flex items-center gap-1 mt-2">
                <svg className="h-3 w-3 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
                Show {hiddenIndicators.length} more
              </summary>
              <div className="space-y-2 mt-2">
                {hiddenIndicators.map((indicator) => (
                  <div key={`hidden-${indicator.id}`} className="rounded-md border border-border bg-background p-3">
                    <p className="font-semibold text-foreground">{indicator.label}</p>
                    <p className="text-muted-foreground">{indicator.note}</p>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
