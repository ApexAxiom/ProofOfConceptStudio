/**
 * Event taxonomy for oil & gas supply chain intelligence.
 *
 * Every ingested article is classified into one event type so ranking and
 * briefs can reason about *what kind of thing happened* instead of relying on
 * bare keyword counts. Weights express how much a category manager typically
 * cares about each event type when triaging a daily brief.
 */

export type BriefEventType =
  | "contract-award"
  | "tender"
  | "ma-consolidation"
  | "capacity-leadtime"
  | "price-cost"
  | "regulatory-tariff"
  | "incident-forcemajeure"
  | "labor"
  | "financial-distress"
  | "project-fid-milestone"
  | "technology"
  | "market-context";

export interface EventTypeMeta {
  type: BriefEventType;
  label: string;
  /** Ranking weight added to an article's materiality score. */
  weight: number;
  description: string;
}

export const EVENT_TYPE_META: Record<BriefEventType, EventTypeMeta> = {
  "contract-award": {
    type: "contract-award",
    label: "Contract award",
    weight: 10,
    description: "A supplier won, extended, or lost work — direct read on pricing power and capacity."
  },
  "incident-forcemajeure": {
    type: "incident-forcemajeure",
    label: "Incident / force majeure",
    weight: 10,
    description: "Outage, accident, weather, or force majeure that can disrupt supply or schedules."
  },
  "financial-distress": {
    type: "financial-distress",
    label: "Supplier distress",
    weight: 10,
    description: "Bankruptcy, restructuring, default, or severe financial stress at a supplier."
  },
  tender: {
    type: "tender",
    label: "Tender / RFP",
    weight: 9,
    description: "Open tender, RFP, or bid round — demand signal that shifts supplier behavior."
  },
  "ma-consolidation": {
    type: "ma-consolidation",
    label: "M&A / consolidation",
    weight: 9,
    description: "Merger, acquisition, divestment, or market exit/entry changing the supplier landscape."
  },
  "regulatory-tariff": {
    type: "regulatory-tariff",
    label: "Regulation / tariff",
    weight: 8,
    description: "Regulatory, trade, tariff, or local-content change affecting cost or eligibility."
  },
  "capacity-leadtime": {
    type: "capacity-leadtime",
    label: "Capacity / lead time",
    weight: 8,
    description: "Capacity added or removed, lead times moving, utilization shifts."
  },
  "price-cost": {
    type: "price-cost",
    label: "Price / cost move",
    weight: 8,
    description: "Benchmark, index, dayrate, or input-cost movement with commercial impact."
  },
  labor: {
    type: "labor",
    label: "Labor",
    weight: 7,
    description: "Strikes, wage agreements, crew shortages, or workforce actions."
  },
  "project-fid-milestone": {
    type: "project-fid-milestone",
    label: "Project / FID",
    weight: 7,
    description: "FID, sanctioning, startup, or major project milestone — a demand-side signal."
  },
  technology: {
    type: "technology",
    label: "Technology",
    weight: 4,
    description: "New technology or service offering that may shift supplier differentiation."
  },
  "market-context": {
    type: "market-context",
    label: "Market context",
    weight: 1,
    description: "General market color without a discrete event."
  }
};

interface EventRule {
  type: BriefEventType;
  pattern: RegExp;
}

/**
 * Ordered rules: the first match wins, so put the most specific / most
 * decision-relevant event types first. Patterns run against title + summary
 * (and optionally body) in lowercase-insensitive mode.
 */
const EVENT_RULES: EventRule[] = [
  {
    type: "incident-forcemajeure",
    pattern:
      /\b(force majeure|explosion|fire (?:broke|breaks|broke out|breaks out)|caught fire|blaze|oil spill|gas leak|blowout|fatalit|injur(?:y|ies|ed)|evacuat|shut[- ]?down after|emergency shutdown|outage|capsiz|collision|grounding|cyber ?attack|ransomware attack|breach(?:ed)? (?:at|of)|hurricane|cyclone|typhoon)\b/i
  },
  {
    type: "financial-distress",
    pattern:
      /\b(bankrupt|chapter 11|insolven|administration|receivership|liquidat|debt restructur|default(?:s|ed)? on|going concern|wind(?:s|ing)? down|lays? off|mass redundanc)\b/i
  },
  {
    type: "contract-award",
    pattern:
      /\b(award(?:s|ed)?|wins?|won|secur(?:es|ed)|clinch(?:es|ed)|land(?:s|ed)) (?:a |an |the |its |new |major |multi[- ]year )?[\w-]*\s?(contract|deal|order|charter|agreement|framework|ltsa|scope|work)|\b(contract|deal|order|charter|ltsa) (?:award|win|extension|renewal)|\bextend(?:s|ed)? (?:a |the |its )?contract|\bletter of (?:award|intent)\b/i
  },
  {
    type: "tender",
    pattern:
      /\b(tender(?:s|ed)?|rfp|rfq|request for (?:proposal|quotation|tender)|invitation to bid|bid(?:ding)? round|call for (?:bids|expressions)|pre[- ]?qualification|expressions? of interest|eoi)\b/i
  },
  {
    type: "ma-consolidation",
    pattern:
      /\b(merger|merges? with|acqui(?:res?|sition|red)|takeover|buyout|divest(?:s|ment|ed|iture)?|sells? (?:its|the) .{0,30}(business|unit|division|stake)|joint venture|jv with|combin(?:es|ation) with|exits? the .{0,20}market|consolidat)\b/i
  },
  {
    type: "regulatory-tariff",
    pattern:
      /\b(tariff|anti[- ]dumping|countervailing|sanction|import dut(?:y|ies)|quota|local content|regulator(?:y|s)?|legislation|new rules?|ruling|permit(?:s|ting)? (?:approv|denied|delay)|environment(?:al)? approval|nopsema|nopta|bsee|boem|ferc|epa|osha|accc|compliance order|ban(?:s|ned)? (?:on|the))\b/i
  },
  {
    type: "labor",
    pattern:
      /\b(strike(?:s|d)?|industrial action|work stoppage|walkout|union(?:s)? (?:vote|reject|approve|demand)|enterprise agreement|wage (?:deal|agreement|negotiation|increase)|labor shortage|labour shortage|crew shortage|skills shortage|workforce cuts?)\b/i
  },
  {
    type: "capacity-leadtime",
    pattern:
      /\b(lead[- ]times?|capacity (?:expansion|addition|cut|constraint|crunch)|utili[sz]ation (?:rate|climb|fell|rose)|stack(?:s|ed|ing)? (?:the )?rig|reactivat(?:es?|ion)|cold[- ]stack|newbuild deliver|backlog (?:grew|grow|shrink|fell|hit)|shortage of|tight(?:ening)? (?:supply|availability|market)|port congestion|yard (?:slots?|capacity)|mill (?:allocation|capacity)|fleet (?:expansion|addition|retire))\b/i
  },
  {
    type: "price-cost",
    pattern:
      /\b(dayrates?|day rates?|price(?:s|d)? (?:rise|rose|jump|surge|fall|fell|drop|slid|climb|spike|cut)|repric|rate (?:increase|hike|cut)|index (?:rose|fell|climbed|dropped)|surcharge|cost inflation|escalation|benchmark|netback|spot (?:price|rate)|futures|premium (?:widen|narrow)|discount(?:s|ed)? (?:deepen|widen))\b/i
  },
  {
    type: "project-fid-milestone",
    pattern:
      /\b(fid|final investment decision|sanction(?:s|ed)? (?:the|a|its)? ?project|first (?:gas|oil|lng|cargo|production)|start[- ]?up|comes? online|commissioning|reach(?:es|ed) (?:a )?milestone|greenlights?|go[- ]ahead for|feed (?:contract|study|phase)|front[- ]end engineering)\b/i
  },
  {
    type: "technology",
    pattern:
      /\b(launch(?:es|ed)? (?:a |its |new )?(?:technology|platform|tool|service|system)|pilot(?:s|ed)? (?:a|new)|automat(?:es|ion|ed)|digital twin|ai[- ](?:powered|driven|based)|robotics?|remote operat|electrif(?:y|ication)|patent(?:s|ed)?|breakthrough|first[- ]of[- ]its[- ]kind)\b/i
  }
];

export interface EventClassification {
  type: BriefEventType;
  label: string;
  weight: number;
}

/**
 * Classifies article text into an event type. First matching rule wins;
 * unmatched text is treated as general market context.
 */
export function classifyEventType(text: string): EventClassification {
  const haystack = (text ?? "").slice(0, 4000);
  for (const rule of EVENT_RULES) {
    if (rule.pattern.test(haystack)) {
      const meta = EVENT_TYPE_META[rule.type];
      return { type: meta.type, label: meta.label, weight: meta.weight };
    }
  }
  const fallback = EVENT_TYPE_META["market-context"];
  return { type: fallback.type, label: fallback.label, weight: fallback.weight };
}

export function eventTypeLabel(type: string | undefined): string {
  if (!type) return EVENT_TYPE_META["market-context"].label;
  return EVENT_TYPE_META[type as BriefEventType]?.label ?? EVENT_TYPE_META["market-context"].label;
}
