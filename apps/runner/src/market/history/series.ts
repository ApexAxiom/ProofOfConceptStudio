import { MarketHistorySeries } from "./types.js";

/**
 * Registry of official-source market data series.
 *
 * PortfolioIndex.historySeriesId (packages/shared/src/portfolio-sources.ts)
 * keys each category's market tiles to entries here, so adding a series to a
 * category is a config change in one place on each side.
 *
 * Provider prerequisites (see update.ts): EIA and FRED need free API keys
 * (EIA_API_KEY / FRED_API_KEY); Baker Hughes is keyless; the ACCC LNG netback
 * series runs only when ACCC_NETBACK_CSV_URL points at the current CSV
 * download from the ACCC netback page.
 */
export const MARKET_HISTORY_SERIES: MarketHistorySeries[] = [
  {
    id: "eia-wti-spot",
    provider: "eia",
    name: "WTI Crude Spot (Cushing)",
    unit: "/bbl",
    sourceUrl: "https://www.eia.gov/petroleum/",
    cadence: "daily",
    params: { seriesId: "PET.RWTC.D" }
  },
  {
    id: "eia-brent-spot",
    provider: "eia",
    name: "Brent Crude Spot",
    unit: "/bbl",
    sourceUrl: "https://www.eia.gov/petroleum/",
    cadence: "daily",
    params: { seriesId: "PET.RBRTE.D" }
  },
  {
    id: "eia-henry-hub-spot",
    provider: "eia",
    name: "Henry Hub Natural Gas Spot",
    unit: "/MMBtu",
    sourceUrl: "https://www.eia.gov/naturalgas/",
    cadence: "daily",
    params: { seriesId: "NG.RNGWHHD.D" }
  },
  {
    id: "fred-diesel-retail",
    provider: "fred",
    name: "US No 2 Diesel Retail Price",
    unit: "/gal",
    sourceUrl: "https://fred.stlouisfed.org/series/GASDESW",
    cadence: "weekly",
    params: { seriesId: "GASDESW" }
  },
  {
    id: "fred-steel-ppi",
    provider: "fred",
    name: "PPI: Steel Mill Products",
    unit: "index",
    sourceUrl: "https://fred.stlouisfed.org/series/WPU1017",
    cadence: "monthly",
    params: { seriesId: "WPU1017" }
  },
  {
    id: "baker-hughes-rig-count-us",
    provider: "baker-hughes",
    name: "US Rotary Rig Count",
    unit: "rigs",
    sourceUrl: "https://rigcount.bakerhughes.com/",
    cadence: "weekly",
    params: { area: "U.S." }
  },
  {
    id: "accc-lng-netback",
    provider: "accc-csv",
    name: "ACCC LNG Netback Price (Wallumbilla)",
    unit: "/GJ",
    sourceUrl:
      "https://www.accc.gov.au/inquiries-and-consultations/gas-inquiry-2017-30/lng-netback-price-series",
    cadence: "monthly",
    params: { urlEnv: "ACCC_NETBACK_CSV_URL" },
    regionScope: ["au"]
  }
];

const seriesById = new Map(MARKET_HISTORY_SERIES.map((series) => [series.id, series]));

export function getMarketHistorySeries(id: string): MarketHistorySeries | undefined {
  return seriesById.get(id);
}
