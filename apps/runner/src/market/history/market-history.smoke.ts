import assert from "node:assert/strict";
import { parseBakerHughesOverview } from "./baker-hughes.js";
import { parseCsvSeries } from "./csv-series.js";
import { parseEiaResponse } from "./eia.js";
import { computeHistoryTrend, enrichSnapshotWithHistory } from "./enrich.js";
import { parseFredResponse } from "./fred.js";
import { MARKET_HISTORY_SERIES, getMarketHistorySeries } from "./series.js";
import { MarketDataPoint } from "./types.js";
import { isSeriesFetchable, updateMarketHistory } from "./update.js";
import { addDaysToDay, daysBetween, normalizeDay, toFiniteNumber } from "./util.js";
import { buildMarketHistoryItem, marketHistoryKeys } from "../../db/market-history.js";
import { getPortfolioIndices } from "@proof/shared";

const FETCHED_AT = "2026-06-10T06:00:00.000Z";

// --- util helpers ---
assert.equal(normalizeDay("2026-06-08"), "2026-06-08");
assert.equal(normalizeDay("2026-05"), "2026-05-01");
assert.equal(normalizeDay("6 June 2026"), "2026-06-06");
assert.equal(normalizeDay("8/06/2026"), "2026-06-08");
assert.equal(normalizeDay("June 2026"), "2026-06-01");
assert.equal(normalizeDay("not a date"), undefined);
assert.equal(toFiniteNumber("1,234.5"), 1234.5);
assert.equal(toFiniteNumber("."), undefined, "FRED missing observations must be rejected");
assert.equal(addDaysToDay("2026-06-10", -7), "2026-06-03");
assert.equal(daysBetween("2026-06-03", "2026-06-10"), 7);

// --- registry / config wiring ---
// Every historySeriesId referenced from the portfolio index config must exist in the registry.
for (const slug of ["rigs-integrated-drilling", "drilling-services", "logistics-marine-aviation", "projects-epc-epcm-construction", "wells-materials-octg"]) {
  for (const index of getPortfolioIndices(slug)) {
    if (!index.historySeriesId) continue;
    assert(
      getMarketHistorySeries(index.historySeriesId),
      `Series ${index.historySeriesId} (portfolio ${slug}) missing from registry`
    );
  }
}
assert(MARKET_HISTORY_SERIES.length >= 6, "Expected the full series registry");

// --- EIA parsing ---
const eiaSeries = getMarketHistorySeries("eia-wti-spot")!;
const eiaPoints = parseEiaResponse(
  {
    response: {
      data: [
        { period: "2026-06-08", value: 72.11 },
        { period: "2026-06-01", value: "75.02" },
        { period: "2026-05-30", value: null },
        { period: "bogus", value: 12 }
      ]
    }
  },
  eiaSeries,
  FETCHED_AT
);
assert.equal(eiaPoints.length, 2, "EIA parse should keep only valid rows");
assert.deepEqual(
  eiaPoints.map((p) => [p.day, p.value]),
  [
    ["2026-06-08", 72.11],
    ["2026-06-01", 75.02]
  ]
);
assert.equal(eiaPoints[0].provider, "eia");
assert.equal(parseEiaResponse({ unexpected: true }, eiaSeries, FETCHED_AT).length, 0);

// --- FRED parsing ---
const fredSeries = getMarketHistorySeries("fred-diesel-retail")!;
const fredPoints = parseFredResponse(
  {
    observations: [
      { date: "2026-06-01", value: "3.602" },
      { date: "2026-05-25", value: "." },
      { date: "2026-05-18", value: "3.655" }
    ]
  },
  fredSeries,
  FETCHED_AT
);
assert.equal(fredPoints.length, 2, "FRED parse should drop '.' observations");
assert.equal(fredPoints[0].value, 3.602);

// --- Baker Hughes parsing ---
const bhSeries = getMarketHistorySeries("baker-hughes-rig-count-us")!;
const bhHtml = `
<table>
  <tr><th>Area</th><th>Last Count</th><th>Count</th><th>Change from Prior Count</th></tr>
  <tr><td>U.S.</td><td>6 June 2026</td><td>588</td><td>+2</td></tr>
  <tr><td>Canada</td><td>6 June 2026</td><td>118</td><td>-1</td></tr>
</table>`;
const bhPoints = parseBakerHughesOverview(bhHtml, bhSeries, FETCHED_AT);
assert.equal(bhPoints.length, 1);
assert.deepEqual([bhPoints[0].day, bhPoints[0].value], ["2026-06-06", 588]);
assert.equal(parseBakerHughesOverview("<html><body>redesigned page</body></html>", bhSeries, FETCHED_AT).length, 0, "Unrecognized page must yield no points, never guesses");

// --- CSV (ACCC netback) parsing ---
const acccSeries = getMarketHistorySeries("accc-lng-netback")!;
const csvPoints = parseCsvSeries(
  `Date,Netback price (A$/GJ)\n"1/05/2026",12.41\n2026-06-01,11.87\nfootnote about methodology,\n`,
  acccSeries,
  FETCHED_AT
);
assert.equal(csvPoints.length, 2);
assert.deepEqual(
  csvPoints.map((p) => [p.day, p.value]),
  [
    ["2026-05-01", 12.41],
    ["2026-06-01", 11.87]
  ]
);

// --- trend computation ---
function point(day: string, value: number): MarketDataPoint {
  return { seriesId: "eia-wti-spot", day, value, unit: "/bbl", provider: "eia", sourceUrl: "https://www.eia.gov/petroleum/", fetchedAt: FETCHED_AT };
}

const dailyTrend = computeHistoryTrend([
  point("2026-06-01", 75.0),
  point("2026-06-05", 73.4),
  point("2026-06-08", 72.0)
]);
assert(dailyTrend?.prior);
assert.equal(dailyTrend!.latest.value, 72.0);
assert.equal(dailyTrend!.prior!.day, "2026-06-01", "Prior should be the closest observation ≥7 days earlier");
assert.equal(dailyTrend!.label, "w/w");

const monthlyTrend = computeHistoryTrend([point("2026-04-01", 280.1), point("2026-05-01", 285.6)]);
assert.equal(monthlyTrend?.label, "m/m", "Sparse series should fall back to the previous observation");
assert.equal(computeHistoryTrend([]), null);
assert.equal(computeHistoryTrend([point("2026-06-08", 72)])?.prior, undefined, "Single point has no trend");

// --- snapshot enrichment (no network, no AWS: injected loader) ---
const history: Record<string, MarketDataPoint[]> = {
  "eia-wti-spot": [point("2026-06-01", 75.0), point("2026-06-08", 72.0)],
  "baker-hughes-rig-count-us": [
    { ...point("2026-05-30", 586), seriesId: "baker-hughes-rig-count-us", unit: "rigs", provider: "baker-hughes" },
    { ...point("2026-06-06", 588), seriesId: "baker-hughes-rig-count-us", unit: "rigs", provider: "baker-hughes" }
  ]
};
const loadHistory = async ({ seriesId }: { seriesId: string }) => history[seriesId] ?? [];

const baseSnapshot = [
  {
    symbol: "WTI",
    name: "WTI Crude",
    unit: "/bbl",
    latest: 72.15,
    change: -1.1,
    changePercent: -1.5,
    asOf: "2026-06-10T05:00:00.000Z",
    sourceUrl: "https://finance.yahoo.com/quote/CL=F",
    dataState: "live" as const
  }
];

const enriched = await enrichSnapshotWithHistory({
  snapshot: baseSnapshot.map((item) => ({ ...item })),
  portfolioSlug: "rigs-integrated-drilling",
  region: "us-mx-la-lng",
  nowIso: "2026-06-10T06:00:00.000Z",
  loadHistory,
  enabled: true
});

const wti = enriched.find((item) => item.symbol === "WTI");
assert(wti, "Existing WTI row should be kept");
assert.equal(wti!.latest, 72.15, "Live quote must not be overwritten by history");
assert.equal(wti!.weekAgoValue, 75.0);
assert.equal(wti!.weekOverWeekPercent, -4.0);
assert.equal(wti!.trendLabel, "w/w");
assert.equal(wti!.provider, "eia");

const rigs = enriched.find((item) => item.symbol === "US_RIGS");
assert(rigs, "History-only rig count row should be added");
assert.equal(rigs!.latest, 588);
assert.equal(rigs!.change, 2);
assert.equal(rigs!.asOf, "2026-06-06T00:00:00.000Z");
assert.equal(rigs!.dataState, "live");

// Region scoping: ACCC netback is AU-only, so it must not appear on us-mx-la-lng briefs.
const lngHistory = { "accc-lng-netback": [point("2026-05-01", 12.41), point("2026-06-01", 11.87)] };
const lngLoad = async ({ seriesId }: { seriesId: string }) => (lngHistory as Record<string, MarketDataPoint[]>)[seriesId] ?? [];
const lngUs = await enrichSnapshotWithHistory({
  snapshot: [],
  portfolioSlug: "projects-epc-epcm-construction",
  region: "us-mx-la-lng",
  nowIso: "2026-06-10T06:00:00.000Z",
  loadHistory: lngLoad,
  enabled: true
});
assert(!lngUs.some((item) => item.symbol === "LNG_NETBACK"), "AU-scoped series must not leak to other regions");
const lngAu = await enrichSnapshotWithHistory({
  snapshot: [],
  portfolioSlug: "projects-epc-epcm-construction",
  region: "au",
  nowIso: "2026-06-10T06:00:00.000Z",
  loadHistory: lngLoad,
  enabled: true
});
assert(lngAu.some((item) => item.symbol === "LNG_NETBACK"), "AU briefs should get the netback row");

// Disabled (default) → exact no-op, including no loader calls.
const untouched = await enrichSnapshotWithHistory({
  snapshot: baseSnapshot,
  portfolioSlug: "rigs-integrated-drilling",
  region: "au",
  nowIso: "2026-06-10T06:00:00.000Z",
  loadHistory: async () => {
    throw new Error("loader must not be called when disabled");
  },
  enabled: false
});
assert.equal(untouched, baseSnapshot);

// --- update orchestration is a no-op unless explicitly enabled ---
delete process.env.MARKET_HISTORY_ENABLED;
const disabledRun = await updateMarketHistory({ nowIso: "2026-06-10T06:00:00.000Z" });
assert.equal(disabledRun.enabled, false);
assert.deepEqual(disabledRun.written, {});

// Provider prerequisites: EIA/FRED need keys, ACCC needs its CSV URL, Baker Hughes is keyless.
const emptyEnv = {} as NodeJS.ProcessEnv;
assert.equal(isSeriesFetchable(eiaSeries, emptyEnv), false);
assert.equal(isSeriesFetchable(fredSeries, emptyEnv), false);
assert.equal(isSeriesFetchable(acccSeries, emptyEnv), false);
assert.equal(isSeriesFetchable(bhSeries, emptyEnv), true);
assert.equal(isSeriesFetchable(eiaSeries, { EIA_API_KEY: "k" } as NodeJS.ProcessEnv), true);
assert.equal(isSeriesFetchable(acccSeries, { ACCC_NETBACK_CSV_URL: "https://example.org/netback.csv" } as NodeJS.ProcessEnv), true);

// --- storage item shape ---
assert.deepEqual(marketHistoryKeys("eia-wti-spot", "2026-06-08"), { PK: "MARKET#eia-wti-spot", SK: "DAY#2026-06-08" });
const item = buildMarketHistoryItem(point("2026-06-08", 72.0));
assert.equal(item.itemType, "market_data_point");
assert.equal(item.value, 72.0);
assert(item.ttl > Date.parse("2026-06-08") / 1000, "TTL must extend beyond the observation day");

console.log("market-history.smoke passed");
