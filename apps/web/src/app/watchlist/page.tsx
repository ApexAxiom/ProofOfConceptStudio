/**
 * Minimal watchlist landing page.
 */
export default function WatchlistPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Watchlist</p>
        <h1 className="text-2xl font-semibold text-foreground">Signals you are tracking</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Track suppliers, indices, and topics to surface what changed since your last review.
        </p>
      </div>

      <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
        Watchlist tracking will populate as you pin suppliers, indices, and topics from briefs.
      </div>
    </div>
  );
}
