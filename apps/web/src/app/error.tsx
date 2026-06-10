"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Route-level error boundary so failures render a branded recovery screen
 * instead of the framework's default crash page.
 */
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Route error boundary:", error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 rounded-2xl border border-border bg-card p-10 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Something went wrong</p>
      <h1 className="text-xl font-semibold text-foreground">This view failed to load</h1>
      <p className="text-sm text-muted-foreground">
        The data source may be briefly unavailable. Your briefs are unaffected — try again, or head back to the Today
        view.
      </p>
      {error.digest ? <p className="text-xs font-mono text-muted-foreground">Ref: {error.digest}</p> : null}
      <div className="mt-2 flex gap-3">
        <button type="button" onClick={reset} className="btn-secondary text-sm">
          Try again
        </button>
        <Link href="/" className="btn-ghost text-sm">
          Back to Today
        </Link>
      </div>
    </div>
  );
}
