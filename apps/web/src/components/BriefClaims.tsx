import { BriefClaim, BriefClaimSection, BriefSourceInput, normalizeBriefSources } from "@proof/shared";

const SECTION_ORDER: BriefClaimSection[] = [
  "summary",
  "highlight",
  "procurement_action",
  "watchlist",
  "delta",
  "top_story",
  "category_importance",
  "market_indicator",
  "vp_snapshot",
  "cm_snapshot",
  "other"
];

const SECTION_LABELS: Record<BriefClaimSection, string> = {
  summary: "Executive Summary",
  highlight: "Market Highlights",
  procurement_action: "Procurement Actions",
  watchlist: "Watchlist",
  delta: "Changes Since Last Brief",
  top_story: "Top Story Claims",
  category_importance: "Category Importance",
  market_indicator: "Market Indicators",
  vp_snapshot: "VP Snapshot",
  cm_snapshot: "Category Manager Snapshot",
  other: "Additional Claims"
};

function statusLabel(status: BriefClaim["status"]) {
  if (status === "supported") return { text: "Evidence-backed", tone: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" };
  if (status === "analysis") return { text: "Analysis", tone: "bg-blue-500/10 text-blue-400 border-blue-500/20" };
  return { text: "Needs verification", tone: "bg-amber-500/10 text-amber-400 border-amber-500/20" };
}

export function BriefClaims({ claims, sources }: { claims?: BriefClaim[]; sources?: BriefSourceInput[] }) {
  if (!claims || claims.length === 0) return null;
  const normalizedSources = normalizeBriefSources(sources);
  const sourcesById = new Map(normalizedSources.map((source) => [source.sourceId, source]));

  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="accent-line" />
        <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Evidence-Backed Claims
        </h2>
      </div>

      <div className="space-y-6">
        {SECTION_ORDER.map((section) => {
          const sectionClaims = claims.filter((claim) => claim.section === section);
          if (sectionClaims.length === 0) return null;
          return (
            <div key={section} className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">{SECTION_LABELS[section]}</h3>
              <div className="space-y-3">
                {sectionClaims.map((claim) => {
                  const status = statusLabel(claim.status);
                  const citationSources = (claim.evidence ?? [])
                    .map((evidence) => sourcesById.get(evidence.sourceId))
                    .filter(Boolean);
                  return (
                    <div key={claim.id} className="rounded-lg border border-border bg-secondary/20 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="text-sm text-foreground">{claim.text}</p>
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold ${status.tone}`}
                        >
                          {status.text}
                        </span>
                      </div>

                      {claim.status === "supported" && citationSources.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                          {citationSources.map((source) => (
                            <a
                              key={source!.sourceId}
                              href={source!.url}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-1 text-foreground hover:border-primary/40 hover:text-primary"
                            >
                              <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
                              {source!.title ?? source!.url}
                            </a>
                          ))}
                        </div>
                      )}

                      {claim.evidence && claim.evidence.length > 0 && (
                        <details className="mt-3">
                          <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
                            Show evidence
                          </summary>
                          <div className="mt-2 space-y-2 text-xs text-muted-foreground">
                            {claim.evidence.map((evidence, idx) => (
                              <div key={`${claim.id}-${idx}`} className="rounded-md border border-border bg-background p-3">
                                <p className="text-foreground">{evidence.excerpt}</p>
                                <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                                  <span>Similarity: {evidence.similarity?.toFixed(2) ?? "n/a"}</span>
                                  <span className="text-border">•</span>
                                  <a
                                    href={evidence.url}
                                    target="_blank"
                                    rel="noreferrer noopener"
                                    className="text-primary hover:underline"
                                  >
                                    Open source
                                  </a>
                                </div>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}

                      {claim.status !== "supported" && (!claim.evidence || claim.evidence.length === 0) && (
                        <p className="mt-2 text-xs text-amber-500">
                          Evidence unavailable for this claim. Validate against primary sources.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
