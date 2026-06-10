import { MarketDataPoint, MarketHistorySeries } from "./types.js";
import { fetchTextWithRetry, isValidDay, normalizeDay, toFiniteNumber } from "./util.js";

/**
 * Baker Hughes rig count adapter (keyless).
 *
 * Parses the "Rig Count Overview" HTML table from the investor-relations
 * page (columns: Area | Last Count | Count | Change from Prior Count | ...).
 * Each run captures one observation (the latest weekly count); history
 * accumulates week by week. The parser is deliberately strict: if the page
 * structure changes it yields no points rather than wrong ones.
 */

const RIG_COUNT_URL = "https://bakerhughesrigcount.gcs-web.com/rig-count-overview";

function stripTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseBakerHughesOverview(
  html: string,
  series: MarketHistorySeries,
  fetchedAt: string
): MarketDataPoint[] {
  const area = series.params.area;
  if (!area) return [];

  const rows = html.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
  for (const row of rows) {
    const cells = (row.match(/<t[dh][\s\S]*?<\/t[dh]>/gi) ?? []).map(stripTags);
    if (cells.length < 3) continue;
    if (cells[0].replace(/\s+/g, " ").trim() !== area) continue;

    // Expected layout: [Area, Last Count (date), Count, Change, ...]
    const day = normalizeDay(cells[1]);
    const value = toFiniteNumber(cells[2]);
    if (!day || !isValidDay(day) || value === undefined || value < 0) continue;

    return [
      {
        seriesId: series.id,
        day,
        value,
        unit: series.unit,
        provider: series.provider,
        sourceUrl: series.sourceUrl,
        fetchedAt
      }
    ];
  }
  return [];
}

export async function fetchBakerHughesSeries(
  series: MarketHistorySeries,
  options: { nowIso: string }
): Promise<MarketDataPoint[]> {
  const html = await fetchTextWithRetry(RIG_COUNT_URL, `baker-hughes:${series.id}`);
  if (!html) return [];
  return parseBakerHughesOverview(html, series, options.nowIso);
}
