import { putMarketHistoryPoints } from "../../db/market-history.js";
import { fetchBakerHughesSeries } from "./baker-hughes.js";
import { fetchCsvSeries, isCsvSeriesConfigured } from "./csv-series.js";
import { fetchEiaSeries, isEiaConfigured } from "./eia.js";
import { fetchFredSeries, isFredConfigured } from "./fred.js";
import { MARKET_HISTORY_SERIES } from "./series.js";
import { MarketDataPoint, MarketHistorySeries } from "./types.js";
import { addDaysToDay } from "./util.js";

/**
 * Daily market-history refresh. Entirely env-gated: nothing runs unless
 * MARKET_HISTORY_ENABLED=true, and each provider additionally requires its
 * own prerequisite (EIA_API_KEY, FRED_API_KEY, ACCC_NETBACK_CSV_URL), so
 * deployments without keys are unaffected. Failures never fail the cron run.
 */

const DEFAULT_LOOKBACK_DAYS = 45;

export function isMarketHistoryEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return (env.MARKET_HISTORY_ENABLED ?? "false").trim().toLowerCase() === "true";
}

export function isSeriesFetchable(series: MarketHistorySeries, env: NodeJS.ProcessEnv = process.env): boolean {
  switch (series.provider) {
    case "eia":
      return isEiaConfigured(env);
    case "fred":
      return isFredConfigured(env);
    case "baker-hughes":
      return true;
    case "accc-csv":
      return isCsvSeriesConfigured(series, env);
    default:
      return false;
  }
}

async function fetchSeriesPoints(
  series: MarketHistorySeries,
  options: { sinceDay: string; nowIso: string }
): Promise<MarketDataPoint[]> {
  switch (series.provider) {
    case "eia":
      return fetchEiaSeries(series, options);
    case "fred":
      return fetchFredSeries(series, options);
    case "baker-hughes":
      return fetchBakerHughesSeries(series, options);
    case "accc-csv":
      return fetchCsvSeries(series, options);
    default:
      return [];
  }
}

export interface MarketHistoryUpdateResult {
  enabled: boolean;
  written: Record<string, number>;
  skipped: string[];
  failed: string[];
}

export async function updateMarketHistory(params: { nowIso: string }): Promise<MarketHistoryUpdateResult> {
  const result: MarketHistoryUpdateResult = { enabled: isMarketHistoryEnabled(), written: {}, skipped: [], failed: [] };
  if (!result.enabled) return result;

  const today = params.nowIso.slice(0, 10);
  const sinceDay = addDaysToDay(today, -DEFAULT_LOOKBACK_DAYS);

  for (const series of MARKET_HISTORY_SERIES) {
    if (!isSeriesFetchable(series)) {
      result.skipped.push(series.id);
      continue;
    }
    try {
      const points = await fetchSeriesPoints(series, { sinceDay, nowIso: params.nowIso });
      result.written[series.id] = points.length > 0 ? await putMarketHistoryPoints(points) : 0;
    } catch (error) {
      result.failed.push(series.id);
      console.warn(`[marketHistory] ${series.id}: update failed`, error);
    }
  }

  return result;
}
