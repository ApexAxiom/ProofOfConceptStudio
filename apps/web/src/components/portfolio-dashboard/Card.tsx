import { ReactNode } from "react";
import { SectionHeader } from "./SectionHeader";

interface DashboardCardProps {
  title: string;
  subtitle?: string;
  meta?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  id?: string;
}

function joinClasses(...values: Array<string | undefined>): string {
  return values.filter(Boolean).join(" ");
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Shared card primitive for portfolio dashboard sections.
 */
export function DashboardCard({
  title,
  subtitle,
  meta,
  actions,
  children,
  className,
  headerClassName,
  bodyClassName,
  id
}: DashboardCardProps) {
  const headingId = id ?? `portfolio-card-${slugify(title)}`;

  return (
    <section className={joinClasses(className)} aria-labelledby={headingId}>
      <SectionHeader
        id={headingId}
        title={title}
        subtitle={subtitle}
        meta={meta}
        actions={actions}
        className={headerClassName}
      />
      <div className={joinClasses(bodyClassName)}>{children}</div>
    </section>
  );
}
