import Link from "next/link";
import { BriefPost } from "@proof/shared";
import { InsightListCard } from "../InsightListCard";
import { VpActionsCard } from "./VpActionsCard";
import { VpHealthCard } from "./VpHealthCard";
import { VpRiskCard } from "./VpRiskCard";
import { VpSignalsCard } from "./VpSignalsCard";

interface VpRegionPanelProps {
  label: string;
  brief?: BriefPost;
}

export function VpRegionPanel({ label, brief }: VpRegionPanelProps) {
  if (!brief) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">{label}</h3>
          <span className="text-xs text-muted-foreground">No brief yet</span>
        </div>
        <p className="text-sm text-muted-foreground">Awaiting first publication.</p>
      </div>
    );
  }

  const vpSnapshot = brief.vpSnapshot;

  if (!vpSnapshot) {
    const fallbackSections = [
      { title: "Highlights", items: brief.highlights },
      { title: "Procurement actions", items: brief.procurementActions },
      { title: "Watchlist", items: brief.watchlist }
    ].filter((section) => (section.items?.length ?? 0) > 0);

    return (
      <div className="space-y-3 rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">{label}</h3>
          <Link href={`/brief/${brief.postId}`} className="text-xs font-medium text-primary hover:underline">
            View brief
          </Link>
        </div>
        <p className="text-xs text-muted-foreground">
          VP snapshot pending. Showing latest highlights and actions from the brief.
        </p>
        <div className="space-y-2">
          {fallbackSections.length === 0 && (
            <p className="text-sm text-muted-foreground">No structured insights available yet.</p>
          )}
          {fallbackSections.map((section) => (
            <InsightListCard key={section.title} title={section.title} items={section.items} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{label}</h3>
          <p className="text-xs text-muted-foreground">
            Updated {new Date(brief.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </p>
        </div>
        <Link href={`/brief/${brief.postId}`} className="text-xs font-medium text-primary hover:underline">
          View brief
        </Link>
      </div>
      <VpHealthCard health={vpSnapshot.health} />
      <VpSignalsCard signals={vpSnapshot.topSignals} brief={brief} />
      <VpActionsCard actions={vpSnapshot.recommendedActions} brief={brief} />
      <VpRiskCard risks={vpSnapshot.riskRegister} brief={brief} />
    </div>
  );
}
