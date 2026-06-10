/**
 * Lightweight skeleton shown while server components stream in.
 */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <div className="h-32 animate-pulse rounded-2xl border border-border bg-card" />
      <div className="h-72 animate-pulse rounded-xl border border-border bg-card" />
      <div className="h-40 animate-pulse rounded-xl border border-border bg-card" />
    </div>
  );
}
