"use client";

import { useMemo } from "react";
import { BriefPost, VpSignal } from "@proof/shared";

function groupSignals(signals: VpSignal[]) {
  return signals.reduce<Record<string, VpSignal[]>>((acc, signal) => {
    const key = `${signal.horizon}:${signal.type}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(signal);
    return acc;
  }, {});
}

/**
 * Displays the VP snapshot with health scores, signals, actions, and risks.
 */
export function VpSnapshotPanel({ brief }: { brief: BriefPost }) {
  const snapshot = brief.vpSnapshot;
  const groupedSignals = useMemo(() => (snapshot ? groupSignals(snapshot.topSignals ?? []) : {}), [snapshot]);

  if (!snapshot) return null;

  const healthTiles = [
    { label: "Overall", value: snapshot.health?.overall ?? 0 },
    { label: "Cost", value: snapshot.health?.costPressure ?? 0 },
    { label: "Supply", value: snapshot.health?.supplyRisk ?? 0 },
    { label: "Schedule", value: snapshot.health?.scheduleRisk ?? 0 },
    { label: "Compliance", value: snapshot.health?.complianceRisk ?? 0 }
  ];

  return (
    <section className="rounded-xl border border-border bg-card p-6 space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">VP Snapshot</p>
        <h3 className="text-lg font-semibold text-foreground">Executive Risk & Action View</h3>
        {snapshot.health?.narrative && (
          <p className="text-sm text-muted-foreground mt-2">{snapshot.health.narrative}</p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {healthTiles.map((tile) => (
          <div key={tile.label} className="rounded-lg border border-border bg-background p-3">
            <div className="text-xs font-semibold text-muted-foreground">{tile.label}</div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-lg font-semibold text-foreground">{tile.value}</span>
              <div className="h-2 w-24 rounded-full bg-muted/60">
                <div
                  className="h-2 rounded-full bg-primary"
                  style={{ width: `${Math.min(100, Math.max(0, tile.value))}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-foreground">Top signals</h4>
          {Object.keys(groupedSignals).length === 0 && (
            <p className="text-sm text-muted-foreground">No signals captured for this run.</p>
          )}
          {Object.entries(groupedSignals).map(([key, signals]) => {
            const [horizon, type] = key.split(":");
            return (
              <div key={key} className="rounded-lg border border-border bg-background p-3 space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="uppercase tracking-wide">{horizon}</span>
                  <span className="capitalize">{type}</span>
                </div>
                {signals.map((signal, idx) => (
                  <div key={`${signal.title}-${idx}`} className="rounded-md bg-muted/40 px-3 py-2 text-sm text-foreground">
                    <p className="font-semibold">{signal.title}</p>
                    <p className="text-xs text-muted-foreground">{signal.impact}</p>
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-foreground">Recommended actions</h4>
          {(snapshot.recommendedActions ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">No VP actions generated.</p>
          )}
          {(snapshot.recommendedActions ?? []).map((action, idx) => (
            <div key={`${action.action}-${idx}`} className="rounded-lg border border-border bg-background p-3 space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{action.ownerRole}</span>
                <span>Due {action.dueInDays}d</span>
              </div>
              <p className="text-sm font-semibold text-foreground">{action.action}</p>
              <p className="text-sm text-muted-foreground">{action.expectedImpact}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground">Risk register</h4>
        {(snapshot.riskRegister ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No risks registered.</p>
        ) : (
          <div className="overflow-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Risk</th>
                  <th className="px-3 py-2 text-left">Trigger</th>
                  <th className="px-3 py-2 text-left">Mitigation</th>
                </tr>
              </thead>
              <tbody>
                {(snapshot.riskRegister ?? []).map((risk, idx) => (
                  <tr key={`${risk.risk}-${idx}`} className="border-t border-border">
                    <td className="px-3 py-2 font-semibold text-foreground">{risk.risk}</td>
                    <td className="px-3 py-2 text-muted-foreground">{risk.trigger}</td>
                    <td className="px-3 py-2 text-muted-foreground">{risk.mitigation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
