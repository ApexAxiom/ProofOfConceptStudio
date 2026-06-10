import Link from "next/link";
import type { ReactNode } from "react";

interface ListRowProps {
  title: string;
  href?: string;
  meta?: string;
  note?: string;
  /** Optional chip (e.g. signal level) rendered inline before the title. */
  badge?: ReactNode;
  className?: string;
  titleClassName?: string;
  metaClassName?: string;
  noteClassName?: string;
  external?: boolean;
}

function joinClasses(...values: Array<string | undefined>): string {
  return values.filter(Boolean).join(" ");
}

/**
 * Shared list row primitive for news, brief, and source lists.
 * Uses Next.js Link for internal navigation and <a> for external links.
 */
export function ListRow({
  title,
  href,
  meta,
  note,
  badge,
  className,
  titleClassName,
  metaClassName,
  noteClassName,
  external = true
}: ListRowProps) {
  const content = (
    <>
      <p className={joinClasses("text-base font-medium text-foreground", titleClassName)}>
        {badge ? <span className="mr-2 inline-flex align-middle">{badge}</span> : null}
        {title}
      </p>
      {meta ? <p className={joinClasses("mt-1 text-xs text-muted-foreground", metaClassName)}>{meta}</p> : null}
      {note ? <p className={joinClasses("mt-2 text-sm text-muted-foreground", noteClassName)}>{note}</p> : null}
    </>
  );

  if (!href) {
    return <article className={joinClasses(className)}>{content}</article>;
  }

  // Use Next.js Link for internal routes (avoids full page reloads)
  if (!external) {
    return (
      <article className={joinClasses(className)}>
        <Link href={href} className="block focus-visible:outline-none">
          {content}
        </Link>
      </article>
    );
  }

  return (
    <article className={joinClasses(className)}>
      <a
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        className="block focus-visible:outline-none"
      >
        {content}
      </a>
    </article>
  );
}
