import { RegionSlug } from "./regions.js";

export type RunWindow = "apac" | "international";

export type VpConfidence = "low" | "medium" | "high";
export type VpHorizon = "0-30d" | "30-180d" | "180d+";
export type VpSignalType = "cost" | "supply" | "schedule" | "regulatory" | "supplier" | "commercial";

export interface CmPriority {
  title: string;
  why: string;
  dueInDays: number;
  confidence: VpConfidence;
  evidenceArticleIndex: number;
}

export interface CmSupplierSignal {
  supplier: string;
  signal: string;
  implication: string;
  nextStep: string;
  confidence: VpConfidence;
  evidenceArticleIndex: number;
}

export interface CmNegotiationLever {
  lever: string;
  whenToUse: string;
  expectedOutcome: string;
  confidence: VpConfidence;
  evidenceArticleIndex: number;
}

export interface CmSnapshot {
  todayPriorities: CmPriority[];
  supplierRadar: CmSupplierSignal[];
  negotiationLevers: CmNegotiationLever[];
  intelGaps?: string[];
  talkingPoints?: string[];
}

export interface DecisionSummary {
  topMove: string;
  whatChanged: string[];
  doNext: string[];
  watchThisWeek: string[];
}

export interface VpHealthScore {
  overall: number;
  costPressure: number;
  supplyRisk: number;
  scheduleRisk: number;
  complianceRisk: number;
  narrative: string;
}

export interface VpSignal {
  title: string;
  type: VpSignalType;
  horizon: VpHorizon;
  confidence: VpConfidence;
  impact: string;
  evidenceArticleIndex: number;
}

export interface VpAction {
  action: string;
  ownerRole: string;
  dueInDays: number;
  expectedImpact: string;
  confidence: VpConfidence;
  evidenceArticleIndex: number;
}

export interface VpRisk {
  risk: string;
  probability: VpConfidence;
  impact: VpConfidence;
  mitigation: string;
  trigger: string;
  horizon: VpHorizon;
  evidenceArticleIndex?: number;
}

export interface VpSnapshot {
  health: VpHealthScore;
  topSignals: VpSignal[];
  recommendedActions: VpAction[];
  riskRegister: VpRisk[];
}

export interface MarketIndex {
  id: string;
  label: string;
  url: string;
  notes?: string;
  regionScope: RegionSlug[];
}

export interface PortfolioDefinition {
  slug: string;
  label: string;
  description: string;
  defaultIndices: MarketIndex[];
}

/**
 * Represents an individual article selected for the brief
 */
export interface SelectedArticle {
  /** Original article title */
  title: string;
  /** Exact URL to the original article - MUST be preserved */
  url: string;
  /** Brief summary generated for this article */
  briefContent: string;
  /** Why this matters for category management - actionable insight */
  categoryImportance?: string;
  /** Key data points or numbers from the article */
  keyMetrics?: string[];
  /** Image URL from this article */
  imageUrl?: string;
  /** Alt text for the image */
  imageAlt?: string;
  /** Publication date of the article */
  publishedAt?: string;
  /** Source/publication name */
  sourceName?: string;
  /** Original input article index for traceability */
  sourceIndex?: number;
  /** Linked source identifier for evidence mapping */
  sourceId?: string;
}

export interface BriefMarketIndicator {
  id: string;
  label: string;
  url: string;
  note: string;
  sourceId?: string;
}

export interface BriefMarketSnapshotItem {
  symbol: string;
  name: string;
  unit: string;
  latest: number;
  change: number;
  changePercent: number;
  asOf: string;
  sourceUrl: string;
  isFallback?: boolean;
}

export type BriefClaimStatus = "supported" | "analysis" | "needs_verification";

export type BriefClaimSection =
  | "summary"
  | "highlight"
  | "procurement_action"
  | "watchlist"
  | "delta"
  | "top_story"
  | "category_importance"
  | "market_indicator"
  | "vp_snapshot"
  | "cm_snapshot"
  | "other";

export interface BriefEvidence {
  sourceId: string;
  url: string;
  title?: string;
  excerpt: string;
  startOffset?: number;
  endOffset?: number;
  contentHash?: string;
  similarity?: number;
}

export interface BriefClaim {
  id: string;
  section: BriefClaimSection;
  text: string;
  status: BriefClaimStatus;
  evidence: BriefEvidence[];
  confidence?: VpConfidence;
  notes?: string;
}

export interface BriefSource {
  sourceId: string;
  url: string;
  title?: string;
  publishedAt?: string;
  retrievedAt?: string;
}

export type BriefSourceInput = BriefSource | string;

export interface BriefPost {
  postId: string;
  title: string;
  region: RegionSlug;
  portfolio: string;
  runWindow: RunWindow;
  status: "published" | "draft" | "failed";
  publishedAt: string;
  summary?: string;
  bodyMarkdown: string;
  sources?: BriefSourceInput[];
  claims?: BriefClaim[];
  
  /** The 3 selected articles with their briefs and exact source links */
  selectedArticles?: SelectedArticle[];

  /** Curated takeaways for quick scanning */
  highlights?: string[];

  /** Explicit procurement actions to take */
  procurementActions?: string[];

  /** Items to monitor closely */
  watchlist?: string[];

  /** Change log against the previous run */
  deltaSinceLastRun?: string[];

  /** Structured market indicator notes */
  marketIndicators?: BriefMarketIndicator[];
  
  /** Hero image from the primary article */
  heroImageUrl?: string;
  /** Exact URL of the article the hero image came from */
  heroImageSourceUrl?: string;
  heroImageAlt?: string;
  
  scannedSources?: string[];
  tags?: string[];
  metrics?: {
    collectedCount?: number;
    extractedCount?: number;
    dedupedCount?: number;
  };
  qualityReport?: {
    issues: string[];
    decision: "publish" | "retry" | "block";
  };
  vpSnapshot?: VpSnapshot;
  cmSnapshot?: CmSnapshot;
  decisionSummary?: DecisionSummary;
  marketSnapshot?: BriefMarketSnapshotItem[];
}

export interface RunLog {
  runId: string;
  runWindow: RunWindow;
  startedAt: string;
  finishedAt?: string;
  results: Record<string, { region: RegionSlug; status: string; error?: string }>;
  counts?: Record<string, number>;
}

export interface AgentFeed {
  name: string;
  url: string;
  type: "rss" | "web";
  notes?: string;
  allowDomains?: string[];
  denyDomains?: string[];
}

export interface AgentConfig {
  id: string;
  portfolio: string;
  label: string;
  description: string;
  maxArticlesToConsider: number;
  articlesPerRun: number;
  feedsByRegion: Record<RegionSlug, AgentFeed[]>;
  allowDomains?: string[];
  denyDomains?: string[];
  lookbackDays?: number;
  mode?: "brief" | "market-dashboard";
}
