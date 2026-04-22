import {
  ProcurementInferenceMode,
  ProcurementSignalStrength,
  SelectedArticleProcurementLens
} from "@proof/shared";
import type { ArticleInput } from "./prompts.js";

type ProcurementLensField =
  | "buyerTakeaway"
  | "costMoney"
  | "supplierCommercial"
  | "safetyOperational"
  | "watchouts";

const GENERIC_LENS_PATTERNS = [
  /^this matters/i,
  /^this is relevant/i,
  /^buyers should monitor/i,
  /^monitor for updates/i,
  /^watch for updates/i,
  /^track developments/i,
  /^category managers should monitor/i,
  /^important for procurement/i,
  /^useful context for the category/i,
  /^this may affect the category/i
];

const UNSUPPORTED_QUANTIFIED_PROCUREMENT_PATTERNS = [
  /\b(?:save|savings?|reduce|cut|lower|avoid|remove|improve|boost|increase|decrease)\b[^.]{0,40}\b\d[\d.,]*(?:%|x|k|m|bn|million|billion)?/i,
  /\b\d[\d.,]*(?:%|x|k|m|bn|million|billion)?\b[^.]{0,40}\b(?:save|savings?|reduce|cut|lower|avoid|remove|improve|boost|increase|decrease)\b/i,
  /\b(?:roi|return on investment|payback)\b[^.]{0,30}\b\d[\d.,]*(?:%|x|k|m|bn|million|billion)?/i
];

function normalizeComparableText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s%./-]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanText(value?: string): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function combinedText(article: Pick<ArticleInput, "title" | "content">): string {
  return `${article.title ?? ""} ${article.content ?? ""}`.trim();
}

function hasConcreteDetail(text: string): boolean {
  return /\d|contract|award|pilot|well|rig|crew|remote|rov|tariff|permit|supplier|tender|price|cost|dayrate|mobil/i.test(text);
}

function remoteOperationsTheme(text: string): boolean {
  return /\b(remote|remotely|tele-?operat|rov|onshore control|digital twin|automation|autonomous|robotics)\b/i.test(text);
}

function connectivityTheme(text: string): boolean {
  return /\b(connectivity|network|bandwidth|latency|cyber|communications?)\b/i.test(text);
}

function costTheme(text: string): boolean {
  return /\b(cost|price|dayrate|benchmark|index|travel|bed space|accommodation|mobili[sz]ation|logistics|inflation|budget)\b/i.test(text);
}

function supplyTheme(text: string): boolean {
  return /\b(capacity|availability|lead time|backlog|slot|crew|fleet|utili[sz]ation|schedule|delay|shortage|supply)\b/i.test(text);
}

function commercialTheme(text: string): boolean {
  return /\b(contract|commercial|tender|bid|award|framework|extension|renewal|pricing term|clause|pass-through|scope)\b/i.test(text);
}

function safetyTheme(text: string): boolean {
  return /\b(safety|incident|exposure|onsite|offshore|personnel|crew|hse|permit|operational risk|operations?)\b/i.test(text);
}

function policyTheme(text: string): boolean {
  return /\b(regulation|regulatory|policy|permit|sanction|tariff|compliance|cyber)\b/i.test(text);
}

function themeBucket(text: string): "remote" | "cost" | "supply" | "commercial" | "safety" | "general" {
  if (remoteOperationsTheme(text)) return "remote";
  if (costTheme(text)) return "cost";
  if (supplyTheme(text)) return "supply";
  if (commercialTheme(text)) return "commercial";
  if (safetyTheme(text) || policyTheme(text)) return "safety";
  return "general";
}

function inferSignalStrength(article: Pick<ArticleInput, "title" | "content" | "contentStatus">): ProcurementSignalStrength {
  if (article.contentStatus === "thin") return "limited";
  const text = combinedText(article);
  const concreteSignals = [
    hasConcreteDetail(text),
    /\d/.test(text),
    commercialTheme(text),
    remoteOperationsTheme(text),
    supplyTheme(text)
  ].filter(Boolean).length;
  if ((article.content ?? "").length >= 500 && concreteSignals >= 2) return "strong";
  if ((article.content ?? "").length >= 220 || concreteSignals >= 1) return "moderate";
  return "limited";
}

function inferInferenceMode(article: Pick<ArticleInput, "title" | "content">): ProcurementInferenceMode {
  const text = combinedText(article);
  if (commercialTheme(text) || costTheme(text) || supplyTheme(text) || safetyTheme(text)) {
    return "source-grounded";
  }
  return "directional";
}

function fallbackBuyerTakeaway(article: Pick<ArticleInput, "title" | "content">, categoryLabel: string): string {
  const text = combinedText(article);
  switch (themeBucket(text)) {
    case "remote":
      return `For ${categoryLabel}, this is a staffing-shape signal: remote operating models can shift work offsite and change which suppliers, systems, and service levels matter most.`;
    case "cost":
      return `For ${categoryLabel}, treat this as a cost-boundary signal rather than just a headline; buyer assumptions may need refreshing before the next quote or award decision.`;
    case "supply":
      return `For ${categoryLabel}, this is mainly an availability and execution signal; sequencing, fallback coverage, and supplier responsiveness may matter more than list price.`;
    case "commercial":
      return `For ${categoryLabel}, the buyer read-through is commercial leverage: scope, validity windows, reopeners, and term structure may now matter as much as headline pricing.`;
    case "safety":
      return `For ${categoryLabel}, the useful read-through is operational discipline: supplier qualification, permit readiness, and site-risk ownership could become more important in the next sourcing step.`;
    default:
      return `For ${categoryLabel}, this is useful directional context for buyer conversations, but it is not strong enough on its own to justify a forced escalation.`;
  }
}

function fallbackCostMoney(article: Pick<ArticleInput, "title" | "content">): string {
  const text = combinedText(article);
  switch (themeBucket(text)) {
    case "remote":
      return "The cost angle is directional, not quantified: moving work offsite can cut travel, rotation, and accommodation exposure, but only if the remote setup stays reliable.";
    case "cost":
      return "Use this to refresh should-cost views and challenge any fast repricing. Keep the read-through directional unless the source itself provides hard commercial numbers.";
    case "supply":
      return "Tighter availability often shows up later as expediting, standby, or substitution cost. The immediate job is to see where delays could become avoidable spend.";
    case "commercial":
      return "The money issue may come through term structure rather than base price alone, especially if suppliers push for escalation language, shorter validity, or broader pass-through.";
    case "safety":
      return "The cost consequence is usually indirect: extra controls, permitting friction, or higher-risk execution can add hidden spend if they are not planned into the scope early.";
    default:
      return "There is no clean savings number here, but the story may still shift cost exposure through timing, supplier posture, or delivery complexity.";
  }
}

function fallbackSupplierCommercial(article: Pick<ArticleInput, "title" | "content">): string {
  const text = combinedText(article);
  switch (themeBucket(text)) {
    case "remote":
      return "Expect scope to move toward software support, communications uptime, cyber obligations, and clearer downtime liability instead of only offshore headcount or hardware supply.";
    case "cost":
      return "Suppliers with fresh cost justification may push harder on reopeners, indexation, shorter quote validity, or pass-through language. Buyers should separate real drivers from negotiation posture.";
    case "supply":
      return "Capacity pressure usually strengthens supplier leverage. Check who can still commit on timing, what backup coverage exists, and whether current contract language protects against slippage.";
    case "commercial":
      return "This is primarily a contracting story: revisit scope boundaries, extension mechanics, and which party carries volatility before those assumptions harden in a live tender.";
    case "safety":
      return "Commercially, this can shift qualification thresholds, insurance asks, or responsibility for site controls. Buyers should check whether suppliers are pricing that risk back into the offer.";
    default:
      return "Supplier posture may change before any benchmark visibly moves, so keep commercial conversations specific on scope, exclusions, and response obligations.";
  }
}

function fallbackSafetyOperational(article: Pick<ArticleInput, "title" | "content">): string {
  const text = combinedText(article);
  switch (themeBucket(text)) {
    case "remote":
      return "Fewer people offshore can reduce exposure and emergency-response load, but the operating model becomes more dependent on connectivity resilience, remote support readiness, and cyber hygiene.";
    case "cost":
      return "The operational risk is indirect: tight budgets or repricing battles often reappear later as reduced slack, substitutions, or execution compromises that buyers then have to manage.";
    case "supply":
      return "Where supplier availability tightens, schedule pressure can spill into safety or quality risk if teams start accepting late substitutions or compressed mobilization windows.";
    case "commercial":
      return "The main operations question is whether the contract still matches field reality. If scope, response times, or liabilities are vague, the risk usually shows up during execution.";
    case "safety":
      return "This has a direct operations angle: site readiness, permit timing, compliance obligations, or exposure management may become gating factors instead of background admin.";
    default:
      return "Treat the operational consequence as directional. Validate where this could change field readiness, supplier response expectations, or execution resilience.";
  }
}

function fallbackWatchouts(article: Pick<ArticleInput, "title" | "content">): string {
  const text = combinedText(article);
  switch (themeBucket(text)) {
    case "remote":
      return connectivityTheme(text)
        ? "Watch bandwidth resilience, latency tolerance, cyber obligations, and who carries downtime cost if the remote link drops."
        : "Watch for connectivity reliability, remote-support response times, and whether the operating model can safely revert onsite if needed.";
    case "cost":
      return "Watch for shorter quote validity, reopeners, pass-through requests, or attempts to reset pricing on the back of weak evidence.";
    case "supply":
      return "Watch lead times, crew or vessel allocation, and whether suppliers are quietly narrowing commitment windows before the next sourcing gate.";
    case "commercial":
      return "Watch scope creep, liability pushback, and term changes that move volatility back onto the buyer even if the base rate looks manageable.";
    case "safety":
      return "Watch permit timing, qualification gaps, operational readiness, and any sign that safety controls are becoming a schedule bottleneck.";
    default:
      return "Watch whether the signal becomes operationally real in supplier behavior, quote terms, or field readiness instead of staying thematic.";
  }
}

function fallbackForField(
  field: ProcurementLensField,
  article: Pick<ArticleInput, "title" | "content" | "contentStatus">,
  categoryLabel: string
): string {
  switch (field) {
    case "buyerTakeaway":
      return fallbackBuyerTakeaway(article, categoryLabel);
    case "costMoney":
      return fallbackCostMoney(article);
    case "supplierCommercial":
      return fallbackSupplierCommercial(article);
    case "safetyOperational":
      return fallbackSafetyOperational(article);
    case "watchouts":
      return fallbackWatchouts(article);
  }
}

export function isWeakProcurementLensText(value?: string): boolean {
  const cleaned = cleanText(value);
  if (!cleaned) return true;
  if (cleaned.length < 24) return true;
  return GENERIC_LENS_PATTERNS.some((pattern) => pattern.test(cleaned));
}

export function hasUnsupportedQuantifiedProcurementClaim(value?: string): boolean {
  const cleaned = cleanText(value);
  if (!cleaned) return false;
  return UNSUPPORTED_QUANTIFIED_PROCUREMENT_PATTERNS.some((pattern) => pattern.test(cleaned));
}

export function buildFallbackProcurementLens(
  article: Pick<ArticleInput, "title" | "content" | "contentStatus">,
  categoryLabel: string
): SelectedArticleProcurementLens {
  return {
    buyerTakeaway: fallbackBuyerTakeaway(article, categoryLabel),
    costMoney: fallbackCostMoney(article),
    supplierCommercial: fallbackSupplierCommercial(article),
    safetyOperational: fallbackSafetyOperational(article),
    watchouts: fallbackWatchouts(article),
    signalStrength: inferSignalStrength(article),
    inferenceMode: inferInferenceMode(article)
  };
}

export function repairProcurementLens(
  raw: Partial<SelectedArticleProcurementLens> | undefined,
  article: Pick<ArticleInput, "title" | "content" | "contentStatus">,
  categoryLabel: string
): SelectedArticleProcurementLens {
  const fallback = buildFallbackProcurementLens(article, categoryLabel);
  const fields: ProcurementLensField[] = [
    "buyerTakeaway",
    "costMoney",
    "supplierCommercial",
    "safetyOperational",
    "watchouts"
  ];

  const repairedFields = Object.fromEntries(
    fields.map((field) => {
      const candidate = cleanText(raw?.[field]);
      if (isWeakProcurementLensText(candidate) || hasUnsupportedQuantifiedProcurementClaim(candidate)) {
        return [field, fallback[field]];
      }
      return [field, candidate];
    })
  ) as Pick<SelectedArticleProcurementLens, ProcurementLensField>;

  const signalStrength: ProcurementSignalStrength =
    raw?.signalStrength === "strong" || raw?.signalStrength === "moderate" || raw?.signalStrength === "limited"
      ? raw.signalStrength
      : fallback.signalStrength;
  const inferenceMode: ProcurementInferenceMode =
    raw?.inferenceMode === "source-grounded" || raw?.inferenceMode === "directional"
      ? raw.inferenceMode
      : fallback.inferenceMode;

  return {
    ...repairedFields,
    signalStrength,
    inferenceMode
  };
}

export function normalizeLensComparableText(value: string): string {
  return normalizeComparableText(value);
}
