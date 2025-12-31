import { VpHealthScore } from "@proof/shared";

function healthColor(score: number): string {
  if (score >= 70) return "text-emerald-600";
  if (score >= 40) return "text-amber-600";
  return "text-red-600";
}

function barColor(score: number): string {
  if (score >= 70) return "bg-emerald-500";
  if (score >= 40) return "bg-amber-500";
  return "bg-red-500";
}

function HealthBar({ label, score }: { label: string; score: number }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="font-semibold text-foreground">{score}</span>
      </div>
      <div className="h-2 rounded-full bg-muted">
        <div className={`h-full rounded-full ${barColor(score)}`} style={{ width: `${Math.min(Math.max(score, 0), 100)}%` }} />
      </div>
    </div>
  );
}

export function VpHealthCard({ health }: { health: VpHealthScore }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Health score</p>
          <div className={`text-3xl font-bold ${healthColor(health.overall)}`}>{health.overall}</div>
        </div>
        <div className="max-w-md text-sm text-muted-foreground">{health.narrative}</div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <HealthBar label="Cost pressure" score={health.costPressure} />
        <HealthBar label="Supply risk" score={health.supplyRisk} />
        <HealthBar label="Schedule risk" score={health.scheduleRisk} />
        <HealthBar label="Compliance risk" score={health.complianceRisk} />
      </div>
    </div>
  );
}
