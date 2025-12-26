import type { BriefPost } from "@proof/shared";

export type SignalType = "regulatory" | "supply-risk" | "cost" | "cyber" | "commercial";

export interface Signal {
  type: SignalType;
  label: string;
  className: string;
}

const SIGNAL_DEFINITIONS: Record<SignalType, Signal> = {
  regulatory: {
    type: "regulatory",
    label: "Regulatory",
    className: "signal-chip signal-regulatory"
  },
  "supply-risk": {
    type: "supply-risk",
    label: "Supply Risk",
    className: "signal-chip signal-supply-risk"
  },
  cost: {
    type: "cost",
    label: "Cost",
    className: "signal-chip signal-cost"
  },
  cyber: {
    type: "cyber",
    label: "Cyber",
    className: "signal-chip signal-cyber"
  },
  commercial: {
    type: "commercial",
    label: "Commercial",
    className: "signal-chip signal-commercial"
  }
};

// Keyword patterns for signal classification
const SIGNAL_PATTERNS: Record<SignalType, RegExp> = {
  regulatory: /\b(tariff|duty|sanction|regulation|compliance|policy|law|legislation|mandate|ban|restriction|penalty|fine)\b/i,
  "supply-risk": /\b(outage|shutdown|strike|shortage|delay|constraint|disruption|force majeure|capacity|bottleneck|suspension|halt|weather|storm|fire|flood)\b/i,
  cost: /\b(price|cost|inflation|rates?|dayrate|margin|budget|expense|fee|premium|discount|savings)\b/i,
  cyber: /\b(breach|ransomware|zero-day|exploit|vulnerability|attack|hack|malware|phishing|cyber|security incident|data leak)\b/i,
  commercial: /\b(contract|award|tender|bid|framework|msa|agreement|deal|acquisition|partnership|joint venture|merger|procurement|rfp|rfq)\b/i
};

/**
 * Infers signal types from a brief's content using keyword heuristics.
 * This is a deterministic classification, not AI-generated.
 * Returns up to 3 signals maximum.
 */
export function inferSignals(brief: BriefPost): Signal[] {
  const textToAnalyze = [
    brief.title,
    brief.summary || "",
    ...(brief.tags || [])
  ].join(" ");

  const detectedSignals: Signal[] = [];

  for (const [signalType, pattern] of Object.entries(SIGNAL_PATTERNS)) {
    if (pattern.test(textToAnalyze)) {
      detectedSignals.push(SIGNAL_DEFINITIONS[signalType as SignalType]);
    }
    // Stop at 3 signals
    if (detectedSignals.length >= 3) break;
  }

  return detectedSignals;
}

/**
 * Get signal definition by type
 */
export function getSignal(type: SignalType): Signal {
  return SIGNAL_DEFINITIONS[type];
}
