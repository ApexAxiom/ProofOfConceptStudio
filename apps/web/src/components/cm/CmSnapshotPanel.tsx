"use client";

import React from "react";

import { useState } from "react";
import { BriefPost } from "@proof/shared";

/**
 * Displays the Category Manager snapshot as a decision-ready panel.
 */
export function CmSnapshotPanel({ brief }: { brief: BriefPost }) {
  const snapshot = brief.cmSnapshot;
  const [copied, setCopied] = useState(false);

  if (!snapshot) return null;

  const { todayPriorities, supplierRadar, negotiationLevers, talkingPoints } = snapshot;
  const visiblePriorities = (todayPriorities ?? []).slice(0, 3);
  const visibleSupplierRadar = (supplierRadar ?? []).slice(0, 3);
  const visibleNegotiationLevers = (negotiationLevers ?? []).slice(0, 3);
  const visibleTalkingPoints = (talkingPoints ?? []).slice(0, 3);
  const hasTalkingPoints = (talkingPoints ?? []).length > 0;

  const copyTalkingPoints = async () => {
    if (!hasTalkingPoints) return;
    await navigator.clipboard.writeText((talkingPoints ?? []).join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <section className="rounded-xl border border-border bg-card p-6 space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Category manager actions</p>
        <h3 className="text-lg font-semibold text-foreground">Action detail for this brief</h3>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-foreground">Today&apos;s priorities</h4>
          {visiblePriorities.length === 0 && (
            <p className="text-sm text-muted-foreground">No CM priorities were generated for this run.</p>
          )}
          {visiblePriorities.map((item, idx) => (
            <div key={`${item.title}-${idx}`} className="rounded-lg border border-border bg-background p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{item.title}</p>
                  <p className="text-sm text-muted-foreground">{item.why}</p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p className="font-semibold text-foreground">Due {item.dueInDays}d</p>
                  <p className="capitalize">{item.confidence}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-foreground">Supplier radar</h4>
          {visibleSupplierRadar.length === 0 && (
            <p className="text-sm text-muted-foreground">No supplier signals captured this run.</p>
          )}
          {visibleSupplierRadar.map((item, idx) => (
            <div key={`${item.supplier}-${idx}`} className="rounded-lg border border-border bg-background p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">{item.supplier}</p>
                <span className="text-xs capitalize text-muted-foreground">{item.confidence}</span>
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Observed supplier signal</p>
              <p className="text-sm text-foreground">{item.signal}</p>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Commercial implication</p>
              <p className="text-sm text-muted-foreground">{item.implication}</p>
              <div className="rounded-md bg-muted/40 px-3 py-2 text-sm text-foreground">
                <span className="font-semibold">Next step:</span> {item.nextStep}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-foreground">Negotiation levers</h4>
          {visibleNegotiationLevers.length === 0 && (
            <p className="text-sm text-muted-foreground">No negotiation levers surfaced.</p>
          )}
          {visibleNegotiationLevers.map((item, idx) => (
            <div key={`${item.lever}-${idx}`} className="rounded-lg border border-border bg-background p-3 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Lever</p>
              <p className="text-sm font-semibold text-foreground">{item.lever}</p>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Use when</p>
              <p className="text-sm text-muted-foreground">{item.whenToUse}</p>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Expected outcome</p>
              <p className="text-sm text-muted-foreground">{item.expectedOutcome}</p>
              <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{item.confidence} confidence</p>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-sm font-semibold text-foreground">Talking points</h4>
            <button
              type="button"
              onClick={copyTalkingPoints}
              disabled={!hasTalkingPoints}
              className="btn-secondary px-3 py-1 text-xs disabled:opacity-50"
            >
              {copied ? "Copied" : "Copy points"}
            </button>
          </div>
          {!hasTalkingPoints && (
            <p className="text-sm text-muted-foreground">No stakeholder talking points yet.</p>
          )}
          {visibleTalkingPoints.map((point, idx) => (
            <div key={`${point}-${idx}`} className="rounded-md bg-muted/40 px-3 py-2 text-sm text-foreground">
              {point}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
