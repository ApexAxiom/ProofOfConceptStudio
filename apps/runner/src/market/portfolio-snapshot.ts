import { BriefMarketSnapshotItem, PortfolioIndex, getPortfolioIndices } from "@proof/shared";

const DEFAULT_LOOKBACK_DAYS = 5;

type SparkSeries = { timestamp: number[]; close: Array<number | null> };

function selectLatestAndPrior(values: Array<number | null>, lookbackDays: number) {
  const cleaned = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (cleaned.length === 0) return { latest: undefined, prior: undefined };
  const latest = cleaned[cleaned.length - 1];
  const priorIndex = Math.max(0, cleaned.length - 1 - lookbackDays);
  const prior = cleaned[priorIndex];
  return { latest, prior };
}

async function fetchSparkSeries(symbols: string[]): Promise<Map<string, SparkSeries>> {
  const sparkMap = new Map<string, SparkSeries>();
  if (symbols.length === 0) return sparkMap;

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/spark?interval=1d&range=1mo&symbols=${symbols.join(",")}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ProofStudio/1.0)" }
    });

    if (!res.ok) return sparkMap;
    const json = await res.json();
    const result = json?.spark?.result as Array<{ symbol: string; response?: SparkSeries[] }>;
    if (!Array.isArray(result)) return sparkMap;

    for (const entry of result) {
      const response = entry.response?.[0];
      if (!response?.timestamp || !response?.close) continue;
      sparkMap.set(entry.symbol, { timestamp: response.timestamp, close: response.close });
    }
  } catch (error) {
    console.warn("[marketSnapshot] Failed to fetch spark series:", error);
  }

  return sparkMap;
}

function buildSnapshotItem(index: PortfolioIndex, series?: SparkSeries): BriefMarketSnapshotItem {
  const { latest, prior } = series
    ? selectLatestAndPrior(series.close, DEFAULT_LOOKBACK_DAYS)
    : { latest: undefined, prior: undefined };

  const latestValue = latest ?? index.fallbackPrice;
  const priorValue = prior ?? latestValue;
  const change = Number((latestValue - priorValue).toFixed(2));
  const changePercent = priorValue ? Number(((change / priorValue) * 100).toFixed(2)) : 0;
  const lastTimestamp = series?.timestamp?.[series.timestamp.length - 1];
  const asOf = lastTimestamp ? new Date(lastTimestamp * 1000).toISOString() : new Date().toISOString();

  return {
    symbol: index.symbol,
    name: index.name,
    unit: index.unit,
    latest: Number(latestValue.toFixed(2)),
    change,
    changePercent,
    asOf,
    sourceUrl: index.sourceUrl,
    isFallback: latest === undefined || prior === undefined
  };
}

/**
 * Fetches a market snapshot for a portfolio using Yahoo Finance spark data.
 */
export async function fetchPortfolioSnapshot(portfolioSlug: string): Promise<BriefMarketSnapshotItem[]> {
  const indices = getPortfolioIndices(portfolioSlug);
  if (indices.length === 0) return [];

  const symbols = indices.map((index) => index.yahooSymbol);
  const sparkMap = await fetchSparkSeries(symbols);

  return indices.map((index) => buildSnapshotItem(index, sparkMap.get(index.yahooSymbol)));
}
