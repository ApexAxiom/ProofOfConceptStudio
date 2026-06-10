import { MarketDataPoint, MarketHistorySeries } from "./types.js";
import { fetchTextWithRetry, isValidDay, normalizeDay, toFiniteNumber } from "./util.js";

/**
 * EIA Open Data v2 adapter (WTI/Brent spot, Henry Hub spot, ...).
 * Uses the v1-compatible seriesid route, gated on the free EIA_API_KEY.
 * https://www.eia.gov/opendata/
 */

const EIA_BASE_URL = "https://api.eia.gov/v2/seriesid";

export function isEiaConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.EIA_API_KEY?.trim());
}

export function parseEiaResponse(
  payload: unknown,
  series: MarketHistorySeries,
  fetchedAt: string
): MarketDataPoint[] {
  const rows = (payload as { response?: { data?: unknown } })?.response?.data;
  if (!Array.isArray(rows)) return [];

  const points: MarketDataPoint[] = [];
  for (const row of rows) {
    const record = row as { period?: unknown; value?: unknown };
    const day = normalizeDay(String(record.period ?? ""));
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

export async function fetchEiaSeries(
  series: MarketHistorySeries,
  options: { sinceDay: string; nowIso: string }
): Promise<MarketDataPoint[]> {
  const apiKey = process.env.EIA_API_KEY?.trim();
  if (!apiKey) return [];
  const eiaSeriesId = series.params.seriesId;
  if (!eiaSeriesId) return [];

  const url =
    `${EIA_BASE_URL}/${encodeURIComponent(eiaSeriesId)}` +
    `?api_key=${encodeURIComponent(apiKey)}&start=${encodeURIComponent(options.sinceDay)}`;
  const raw = await fetchTextWithRetry(url, `eia:${series.id}`);
  if (!raw) return [];

  try {
    return parseEiaResponse(JSON.parse(raw), series, options.nowIso);
  } catch (error) {
    console.warn(`[marketHistory] eia:${series.id}: parse failed`, error);
    return [];
  }
}
