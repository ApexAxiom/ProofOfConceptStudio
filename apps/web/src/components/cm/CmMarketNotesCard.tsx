import { BriefPost } from "@proof/shared";

interface CmMarketNotesCardProps {
  brief?: BriefPost;
}

export function CmMarketNotesCard({ brief }: CmMarketNotesCardProps) {
  const marketIndicators = brief?.marketIndicators ?? [];

  if (marketIndicators.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200">
          📈
        </span>
        <span>Market notes</span>
      </div>
      <div className="space-y-2 text-sm">
        {marketIndicators.map((indicator) => (
          <div key={indicator.id} className="rounded-md border border-border bg-background p-3">
            <p className="font-semibold text-foreground">{indicator.label}</p>
            <p className="text-muted-foreground">{indicator.note}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
