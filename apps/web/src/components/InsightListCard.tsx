import { ReactNode } from "react";

interface InsightListCardProps {
  title: string;
  items?: string[];
  icon?: ReactNode;
  accentClass?: string;
}

export function InsightListCard({ title, items, icon, accentClass }: InsightListCardProps) {
  if (!items || items.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        {icon && <span className={`flex h-8 w-8 items-center justify-center rounded-lg bg-primary/5 text-primary ${accentClass || ""}`}>{icon}</span>}
        <span>{title}</span>
      </div>
      <ul className="space-y-2 text-sm text-muted-foreground">
        {items.map((item, idx) => (
          <li key={`${title}-${idx}`} className="flex gap-2">
            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
            <span className="leading-relaxed text-foreground">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
