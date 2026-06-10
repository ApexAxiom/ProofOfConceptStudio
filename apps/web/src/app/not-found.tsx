import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 rounded-2xl border border-border bg-card p-10 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">404</p>
      <h1 className="text-xl font-semibold text-foreground">That page doesn&apos;t exist</h1>
      <p className="text-sm text-muted-foreground">
        The brief or page you&apos;re looking for may have expired (briefs are retained for six months) or the link may
        be out of date.
      </p>
      <Link href="/" className="btn-secondary mt-2 text-sm">
        Back to Today
      </Link>
    </div>
  );
}
