import { BriefMarketSnapshotItem, RegionSlug, getPortfolioIndices } from "@proof/shared";
import { getMarketHistory } from "../../db/market-history.js";
import { getMarketHistorySeries } from "./series.js";
import { MarketDataPoint } from "./types.js";
import { addDaysToDay, daysBetween } from "./util.js";

/**
 * Adds official-source week-over-week trend to brief market snapshots from
 * the stored daily history ("WTI $72, down 4% w/w" instead of spot-only).
 *
 * - Indices that already have a live quote keep it and gain trend fields.
 * - History-only indices (rig count, netback) become snapshot rows of their
 *   own — values come straight from the stored history, never fabricated.
 */

const HISTORY_WINDOW_DAYS = 60;
const WEEK_TREND_TARGET_DAYS = 7;

export interface HistoryTrend {
  latest: MarketDataPoint;
  prior?: MarketDataPoint;
  label?: string;
}

/** Picks the latest point and the closest observation ~one week earlier. */
export function computeHistoryTrend(points: MarketDataPoint[]): HistoryTrend | null {
  const sorted = [...points].sort((a, b) => a.day.localeCompare(b.day));
  const latest = sorted[sorted.length - 1];
  if (!latest) return null;

  const targetDay = addDaysToDay(latest.day, -WEEK_TREND_TARGET_DAYS);
  let prior = [...sorted].reverse().find((point) => point.day <= targetDay);
  if (!prior && sorted.length >= 2) {
    // Sparse series (e.g. monthly PPI): fall back to the previous observation.
    prior = sorted[sorted.length - 2];
  }
  if (!prior) return { latest };

  const gapDays = daysBetween(prior.day, latest.day);
  const label = gapDays <= 10 ? "w/w" : gapDays <= 45 ? "m/m" : "vs prior";
  return { latest, prior, label };
}

type HistoryLoader = (params: { seriesId: string; sinceDay: string }) => Promise<MarketDataPoint[]>;

export async function enrichSnapshotWithHistory(params: {
  snapshot: BriefMarketSnapshotItem[];
  portfolioSlug: string;
  region: RegionSlug;
  nowIso: string;
  /** Injectable for offline tests; defaults to the DynamoDB history reader. */
  loadHistory?: HistoryLoader;
  enabled?: boolean;
}): Promise<BriefMarketSnapshotItem[]> {
  const enabled =
    params.enabled ?? (process.env.MARKET_HISTORY_ENABLED ?? "false").trim().toLowerCase() === "true";
  if (!enabled) return params.snapshot;

  const loadHistory = params.loadHistory ?? getMarketHistory;
  const sinceDay = addDaysToDay(params.nowIso.slice(0, 10), -HISTORY_WINDOW_DAYS);
  const items = [...params.snapshot];

  const historyIndices = getPortfolioIndices(params.portfolioSlug).filter((index) => index.historySeriesId);
  const seenSeries = new Set<string>();

  for (const index of historyIndices) {
    const series = getMarketHistorySeries(index.historySeriesId!);
    if (!series || seenSeries.has(series.id)) continue;
    seenSeries.add(series.id);
    if (series.regionScope && !series.regionScope.includes(params.region)) continue;

    let trend: HistoryTrend | null = null;
    try {
      trend = computeHistoryTrend(await loadHistory({ seriesId: series.id, sinceDay }));
    } catch (error) {
      console.warn(`[marketHistory] ${series.id}: history read failed`, error);
      continue;
    }
    if (!trend?.prior || trend.prior.value === 0) continue;

    const weekOverWeekPercent = Number(
      (((trend.latest.value - trend.prior.value) / trend.prior.value) * 100).toFixed(2)
    );
    const trendFields = {
      weekAgoValue: Number(trend.prior.value.toFixed(2)),
      weekOverWeekPercent,
      trendLabel: trend.label,
      provider: series.provider
    };

    const existing = items.find((item) => item.symbol === index.symbol);
    if (existing) {
      Object.assign(existing, trendFields);
      continue;
    }

    items.push({
      symbol: index.symbol,
      name: index.name,
      unit: index.unit,
      latest: Number(trend.latest.value.toFixed(2)),
      change: Number((trend.latest.value - trend.prior.value).toFixed(2)),
      changePercent: weekOverWeekPercent,
      asOf: `${trend.latest.day}T00:00:00.000Z`,
      sourceUrl: index.sourceUrl,
      dataState: "live",
      ...trendFields
    });
  }

  return items;
}
