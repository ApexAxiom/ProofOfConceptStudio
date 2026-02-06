interface ListRowProps {
  title: string;
  href?: string;
  meta?: string;
  note?: string;
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
 */
export function ListRow({
  title,
  href,
  meta,
  note,
  className,
  titleClassName,
  metaClassName,
  noteClassName,
  external = true
}: ListRowProps) {
  const content = (
    <>
      <p className={joinClasses("text-base font-medium text-foreground", titleClassName)}>{title}</p>
      {meta ? <p className={joinClasses("mt-1 text-xs text-muted-foreground", metaClassName)}>{meta}</p> : null}
      {note ? <p className={joinClasses("mt-2 text-sm text-muted-foreground", noteClassName)}>{note}</p> : null}
    </>
  );

  if (!href) {
    return <article className={joinClasses(className)}>{content}</article>;
  }

  return (
    <article className={joinClasses(className)}>
      <a
        href={href}
        target={external ? "_blank" : undefined}
        rel={external ? "noreferrer noopener" : undefined}
        className="block focus-visible:outline-none"
      >
        {content}
      </a>
    </article>
  );
}
