import { RegionSlug } from "./regions.js";

export type RunWindow = "am" | "pm";

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
  /** Image URL from this article */
  imageUrl?: string;
  /** Alt text for the image */
  imageAlt?: string;
  /** Publication date of the article */
  publishedAt?: string;
  /** Source/publication name */
  sourceName?: string;
}

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
  sources: string[];
  
  /** The 3 selected articles with their briefs and exact source links */
  selectedArticles?: SelectedArticle[];
  
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
}
