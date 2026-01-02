import { BriefPost } from "@proof/shared";

interface CmDeltaCardProps {
  brief?: BriefPost;
}

const DEFAULT_VISIBLE = 3;

export function CmDeltaCard({ brief }: CmDeltaCardProps) {
  const deltas = brief?.deltaSinceLastRun ?? [];

  const visibleDeltas = deltas.slice(0, DEFAULT_VISIBLE);
  const hiddenDeltas = deltas.slice(DEFAULT_VISIBLE);

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-200">
          🔄
        </span>
        <span>What changed since last run</span>
      </div>

      {deltas.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No data yet. This will populate after the next brief run.
        </p>
      )}

      {deltas.length > 0 && (
        <div className="space-y-2">
          <ul className="space-y-2">
            {visibleDeltas.map((item, idx) => (
              <li key={`delta-${idx}`} className="flex items-start gap-2 text-sm">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" aria-hidden />
                <span className="text-foreground">{item}</span>
              </li>
            ))}
          </ul>

          {hiddenDeltas.length > 0 && (
            <details className="group">
              <summary className="text-xs text-primary cursor-pointer hover:underline list-none flex items-center gap-1">
                <svg className="h-3 w-3 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
                Show {hiddenDeltas.length} more
              </summary>
              <ul className="space-y-2 mt-2">
                {hiddenDeltas.map((item, idx) => (
                  <li key={`hidden-delta-${idx}`} className="flex items-start gap-2 text-sm">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" aria-hidden />
                    <span className="text-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
