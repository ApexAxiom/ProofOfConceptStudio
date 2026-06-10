import { MarketDataPoint, MarketHistorySeries } from "./types.js";
import { fetchTextWithRetry, isValidDay, normalizeDay, toFiniteNumber } from "./util.js";

/**
 * Generic two-column CSV adapter (date, value), used for the ACCC LNG netback
 * price series. The ACCC publishes the data as a downloadable file whose URL
 * changes between publications, so the URL is env-configured (see the
 * series registry params.urlEnv) and the adapter is a no-op until it is set.
 */

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

export function parseCsvSeries(
  csv: string,
  series: MarketHistorySeries,
  fetchedAt: string
): MarketDataPoint[] {
  const points: MarketDataPoint[] = [];
  const seenDays = new Set<string>();

  for (const line of csv.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const cells = splitCsvLine(line);
    if (cells.length < 2) continue;
    const day = normalizeDay(cells[0]);
    const value = toFiniteNumber(cells[1]);
    // Header rows and footnotes fail date/number parsing and are skipped.
    if (!day || !isValidDay(day) || value === undefined) continue;
    if (seenDays.has(day)) continue;
    seenDays.add(day);
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

  return points.sort((a, b) => a.day.localeCompare(b.day));
}

export function isCsvSeriesConfigured(
  series: MarketHistorySeries,
  env: NodeJS.ProcessEnv = process.env
): boolean {
  const urlEnv = series.params.urlEnv;
  return Boolean(urlEnv && env[urlEnv]?.trim());
}

export async function fetchCsvSeries(
  series: MarketHistorySeries,
  options: { sinceDay: string; nowIso: string }
): Promise<MarketDataPoint[]> {
  const urlEnv = series.params.urlEnv;
  const url = urlEnv ? process.env[urlEnv]?.trim() : undefined;
  if (!url) return [];

  const csv = await fetchTextWithRetry(url, `${series.provider}:${series.id}`);
  if (!csv) return [];
  return parseCsvSeries(csv, series, options.nowIso).filter((point) => point.day >= options.sinceDay);
}
