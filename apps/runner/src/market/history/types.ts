import { RegionSlug } from "@proof/shared";

export type MarketHistoryProvider = "eia" | "fred" | "baker-hughes" | "accc-csv";

/**
 * A registered official-source market data series. Values are fetched on the
 * daily cron (env-gated) and stored as one DynamoDB item per observation day,
 * so briefs and market tiles can show real week-over-week trend instead of
 * spot-only quotes.
 */
export interface MarketHistorySeries {
  /** Stable id, referenced by PortfolioIndex.historySeriesId. */
  id: string;
  provider: MarketHistoryProvider;
  name: string;
  unit: string;
  /** Human-readable source page used for attribution links. */
  sourceUrl: string;
  cadence: "daily" | "weekly" | "monthly";
  /**
   * Provider-specific lookup parameters:
   * - eia: { seriesId } (v2 seriesid route, e.g. "PET.RWTC.D")
   * - fred: { seriesId } (e.g. "GASDESW")
   * - baker-hughes: { area } (row label in the rig count overview table)
   * - accc-csv: { urlEnv } (env var holding the CSV download URL)
   */
  params: Record<string, string>;
  /** Restrict history-backed snapshot rows to these regions (omit = all). */
  regionScope?: RegionSlug[];
}

/** One stored observation for a series. Never fabricated: parse failures yield no points. */
export interface MarketDataPoint {
  seriesId: string;
  /** Observation day, YYYY-MM-DD. */
  day: string;
  value: number;
  unit: string;
  provider: MarketHistoryProvider;
  sourceUrl: string;
  fetchedAt: string;
}
