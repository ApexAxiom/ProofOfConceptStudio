import { ReactNode } from "react";

/**
 * Soft empty/pending state. Presents missing data as "in progress" rather
 * than an error so quiet periods don't read as failures.
 */
export function EmptyState({
  title,
  hint,
  compact = false,
  icon
}: {
  title: string;
  hint?: string;
  compact?: boolean;
  icon?: ReactNode;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 text-center ${
        compact ? "px-4 py-5" : "px-6 py-10"
      }`}
    >
      {icon ?? (
        <span className="mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-muted-foreground">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </span>
      )}
      <p className={`font-medium text-foreground ${compact ? "text-sm" : "text-base"}`}>{title}</p>
      {hint ? <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
