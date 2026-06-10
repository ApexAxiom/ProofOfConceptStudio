import { MarketDataPoint, MarketHistorySeries } from "./types.js";
import { fetchTextWithRetry, isValidDay, normalizeDay, toFiniteNumber } from "./util.js";

/**
 * FRED (St. Louis Fed) observations adapter, gated on the free FRED_API_KEY.
 * https://fred.stlouisfed.org/docs/api/fred/series_observations.html
 */

const FRED_BASE_URL = "https://api.stlouisfed.org/fred/series/observations";

export function isFredConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.FRED_API_KEY?.trim());
}

export function parseFredResponse(
  payload: unknown,
  series: MarketHistorySeries,
  fetchedAt: string
): MarketDataPoint[] {
  const rows = (payload as { observations?: unknown })?.observations;
  if (!Array.isArray(rows)) return [];

  const points: MarketDataPoint[] = [];
  for (const row of rows) {
    const record = row as { date?: unknown; value?: unknown };
    const day = normalizeDay(String(record.date ?? ""));
    // FRED reports missing observations as ".", which toFiniteNumber rejects.
    const value = toFiniteNumber(record.value);
    if (!day || !isValidDay(day) || value === undefined) continue;
    points.push({
      seriesId: series.id,
      day,
      value,
      unit: series.unit,
      provider: series.provider,
      sourceUrl: series.sourceUrl,
      fetchedAt
    });
  }
  return points;
}

export async function fetchFredSeries(
  series: MarketHistorySeries,
  options: { sinceDay: string; nowIso: string }
): Promise<MarketDataPoint[]> {
  const apiKey = process.env.FRED_API_KEY?.trim();
  if (!apiKey) return [];
  const fredSeriesId = series.params.seriesId;
  if (!fredSeriesId) return [];

  const url =
    `${FRED_BASE_URL}?series_id=${encodeURIComponent(fredSeriesId)}` +
    `&api_key=${encodeURIComponent(apiKey)}&file_type=json` +
    `&observation_start=${encodeURIComponent(options.sinceDay)}`;
  const raw = await fetchTextWithRetry(url, `fred:${series.id}`);
  if (!raw) return [];

  try {
    return parseFredResponse(JSON.parse(raw), series, options.nowIso);
  } catch (error) {
    console.warn(`[marketHistory] fred:${series.id}: parse failed`, error);
    return [];
  }
}
