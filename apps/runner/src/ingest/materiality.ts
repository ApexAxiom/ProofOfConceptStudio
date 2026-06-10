import {
  BriefEventType,
  BriefSignalLevel,
  EVENT_TYPE_META,
  RegionSlug,
  classifyEventType,
  matchEntities
} from "@proof/shared";

/**
 * Materiality assessment for ingested articles.
 *
 * Layers an oil & gas supply chain lens on top of keyword relevance: what kind
 * of event happened (event taxonomy), whether it names suppliers/operators the
 * category actually buys from (supplier registry), and how fresh it is. The
 * combined score is what ranking should sort by — a tender award naming a
 * registry supplier in-region outranks generic market commentary.
 */

export interface MaterialityAssessment {
  eventType: BriefEventType;
  eventLabel: string;
  eventWeight: number;
  /** Canonical names of matched registry entities (suppliers first). */
  entities: string[];
  supplierMatches: number;
  operatorMatches: number;
  entityScore: number;
  recencyScore: number;
  /** eventWeight + entityScore + recencyScore */
  materialityScore: number;
}

const SUPPLIER_MATCH_POINTS = 6;
const OPERATOR_MATCH_POINTS = 3;
const MAX_ENTITY_SCORE = 15;
const MAX_RECENCY_SCORE = 6;

function recencyScoreFor(publishedAt?: string): number {
  if (!publishedAt) return 0;
  const ageMs = Date.now() - new Date(publishedAt).getTime();
  if (!Number.isFinite(ageMs) || ageMs < 0) return 0;
  const ageHours = ageMs / 3_600_000;
  if (ageHours <= 24) return MAX_RECENCY_SCORE;
  if (ageHours <= 48) return 4;
  if (ageHours <= 72) return 2;
  return 0;
}

export function assessArticleMateriality(params: {
  title: string;
  summary?: string;
  content?: string;
  publishedAt?: string;
  portfolio: string;
  region: RegionSlug;
}): MaterialityAssessment {
  const headlineText = `${params.title}. ${params.summary ?? ""}`;
  const fullText = `${headlineText} ${params.content ?? ""}`;

  // Event classification leans on headline + summary: that's where the event
  // verb lives, and body text often contains unrelated boilerplate.
  const event = classifyEventType(headlineText.length >= 60 ? headlineText : fullText);

  const matches = matchEntities(fullText, params.portfolio, params.region);
  const suppliers = matches.filter((match) => match.kind === "supplier");
  const operators = matches.filter((match) => match.kind === "operator");
  const entityScore = Math.min(
    MAX_ENTITY_SCORE,
    suppliers.length * SUPPLIER_MATCH_POINTS + operators.length * OPERATOR_MATCH_POINTS
  );

  const recencyScore = recencyScoreFor(params.publishedAt);

  return {
    eventType: event.type,
    eventLabel: event.label,
    eventWeight: event.weight,
    entities: [...suppliers.map((match) => match.name), ...operators.map((match) => match.name)],
    supplierMatches: suppliers.length,
    operatorMatches: operators.length,
    entityScore,
    recencyScore,
    materialityScore: event.weight + entityScore + recencyScore
  };
}

const ACT_EVENT_TYPES: ReadonlySet<BriefEventType> = new Set([
  "contract-award",
  "incident-forcemajeure",
  "financial-distress",
  "tender",
  "ma-consolidation"
]);

const WATCH_EVENT_TYPES: ReadonlySet<BriefEventType> = new Set([
  "regulatory-tariff",
  "capacity-leadtime",
  "price-cost",
  "labor",
  "project-fid-milestone"
]);

/**
 * Derives the day's triage level from the selected articles' assessments.
 * - "act": a high-impact event type involving a registry supplier, or several
 *   high-impact events at once.
 * - "watch": developing signals (price, capacity, regulatory, project) or a
 *   high-impact event without a known supplier attached.
 * - "awareness": nothing material — content is for general awareness only.
 */
export function deriveSignalLevel(assessments: MaterialityAssessment[]): BriefSignalLevel {
  if (assessments.length === 0) return "awareness";

  const actHits = assessments.filter((assessment) => ACT_EVENT_TYPES.has(assessment.eventType));
  const actWithSupplier = actHits.filter((assessment) => assessment.supplierMatches > 0);
  if (actWithSupplier.length > 0 || actHits.length >= 2) return "act";

  const watchHits = assessments.filter(
    (assessment) =>
      WATCH_EVENT_TYPES.has(assessment.eventType) ||
      ACT_EVENT_TYPES.has(assessment.eventType) ||
      assessment.supplierMatches > 0
  );
  if (watchHits.length > 0) return "watch";

  return "awareness";
}

export function describeEventMeta(eventType: BriefEventType): string {
  return EVENT_TYPE_META[eventType]?.description ?? "";
}
