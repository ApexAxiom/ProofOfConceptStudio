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
    <div className="rounded-xl border border-border bg-card p-5 space-y-4 transition-all duration-300 hover:border-primary/20">
      <div className="flex items-center gap-3">
        {icon && (
          <span className={`flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/10 text-lg ${accentClass || ""}`}>
            {icon}
          </span>
        )}
        <span className="font-display text-sm font-semibold text-foreground">{title}</span>
      </div>
      <ul className="space-y-2.5">
        {items.map((item, idx) => (
          <li 
            key={`${title}-${idx}`} 
            className="flex gap-3 text-sm reveal-up"
            style={{ animationDelay: `${idx * 0.05}s` }}
          >
            <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0 shadow-[0_0_4px_rgba(212,175,55,0.4)]" aria-hidden />
            <span className="leading-relaxed text-foreground">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
