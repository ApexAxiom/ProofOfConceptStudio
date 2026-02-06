import { ReactNode } from "react";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  meta?: string;
  actions?: ReactNode;
  id?: string;
  className?: string;
}

function joinClasses(...values: Array<string | undefined>): string {
  return values.filter(Boolean).join(" ");
}

/**
 * Shared section header used in portfolio dashboard cards.
 */
export function SectionHeader({ title, subtitle, meta, actions, id, className }: SectionHeaderProps) {
  return (
    <header className={joinClasses(className)}>
      <div>
        <h2 id={id} className="text-[20px] font-semibold text-foreground leading-tight">
          {title}
        </h2>
        {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
        {meta ? <p className="mt-1 text-xs text-muted-foreground">{meta}</p> : null}
      </div>
      {actions ? <div>{actions}</div> : null}
    </header>
  );
}
