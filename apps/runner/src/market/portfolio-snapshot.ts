import { promises as fs } from "node:fs";
import path from "node:path";
import { BriefMarketSnapshotItem, PortfolioIndex, getPortfolioIndices } from "@proof/shared";

const DEFAULT_LOOKBACK_DAYS = 5;
const RETRY_BACKOFF_MS = [300, 900, 1800];
const CACHE_DIR = path.join(process.cwd(), ".cache");
const CACHE_FILE = path.join(CACHE_DIR, "runner-market-snapshot.json");

type SparkSeries = { timestamp: number[]; close: Array<number | null> };

interface StoredQuote {
  latest: number;
  prior: number;
  asOf: string;
}

interface SnapshotStore {
  savedAt: string;
  quotes: Record<string, StoredQuote>;
}

function storeKey(index: PortfolioIndex): string {
  return `${index.symbol}:${index.yahooSymbol}`;
}

function selectLatestAndPrior(values: Array<number | null>, lookbackDays: number) {
  const cleaned = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (cleaned.length === 0) return { latest: undefined, prior: undefined };
  const latest = cleaned[cleaned.length - 1];
  const priorIndex = Math.max(0, cleaned.length - 1 - lookbackDays);
  const prior = cleaned[priorIndex];
  return { latest, prior };
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function readStore(): Promise<SnapshotStore | null> {
  try {
    const raw = await fs.readFile(CACHE_FILE, "utf-8");
    return JSON.parse(raw) as SnapshotStore;
  } catch {
    return null;
  }
}

async function writeStore(store: SnapshotStore): Promise<void> {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(CACHE_FILE, JSON.stringify(store, null, 2), "utf-8");
  } catch {
    // Best effort persistence only.
  }
}

async function fetchSparkSeries(symbols: string[]): Promise<Map<string, SparkSeries>> {
  const sparkMap = new Map<string, SparkSeries>();
  if (symbols.length === 0) return sparkMap;
  const unique = Array.from(new Set(symbols));
  const url = `https://query1.finance.yahoo.com/v8/finance/spark?interval=1d&range=1mo&symbols=${encodeURIComponent(unique.join(","))}`;

  for (let attempt = 0; attempt < RETRY_BACKOFF_MS.length; attempt += 1) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; ProofStudio/1.0)" },
        cache: "no-store"
      });

      if (!res.ok) {
        if (attempt < RETRY_BACKOFF_MS.length - 1) {
          await sleep(RETRY_BACKOFF_MS[attempt]);
          continue;
        }
        return sparkMap;
      }

      const json = await res.json();
      const result = json?.spark?.result as Array<{ symbol: string; response?: SparkSeries[] }>;
      if (!Array.isArray(result)) return sparkMap;

      for (const entry of result) {
        const response = entry.response?.[0];
        if (!response?.timestamp || !response?.close) continue;
        sparkMap.set(entry.symbol, { timestamp: response.timestamp, close: response.close });
      }
      return sparkMap;
    } catch (error) {
      if (attempt < RETRY_BACKOFF_MS.length - 1) {
        await sleep(RETRY_BACKOFF_MS[attempt]);
        continue;
      }
      console.warn("[marketSnapshot] Failed to fetch spark series:", error);
    }
  }

  return sparkMap;
}

function toSnapshotItem(options: {
  index: PortfolioIndex;
  latest: number;
  prior: number;
  asOf: string;
  dataState: "live" | "stale" | "fallback";
}): BriefMarketSnapshotItem {
  const change = Number((options.latest - options.prior).toFixed(2));
  const changePercent = options.prior ? Number(((change / options.prior) * 100).toFixed(2)) : 0;

  return {
    symbol: options.index.symbol,
    name: options.index.name,
    unit: options.index.unit,
    latest: Number(options.latest.toFixed(2)),
    change,
    changePercent,
    asOf: options.asOf,
    sourceUrl: options.index.sourceUrl,
    dataState: options.dataState,
    isFallback: options.dataState !== "live"
  };
}

/**
 * Fetches a market snapshot for a portfolio using Yahoo Finance spark data.
 * Uses retries and last-known-good storage before falling back to static values.
 */
export async function fetchPortfolioSnapshot(portfolioSlug: string): Promise<BriefMarketSnapshotItem[]> {
  const indices = getPortfolioIndices(portfolioSlug);
  if (indices.length === 0) return [];

  const store = (await readStore()) ?? { savedAt: new Date().toISOString(), quotes: {} };
  const symbols = indices.map((index) => index.yahooSymbol);
  const sparkMap = await fetchSparkSeries(symbols);
  const nextStoredQuotes = { ...store.quotes };
  const nowIso = new Date().toISOString();

  const items = indices.map((index) => {
    const series = sparkMap.get(index.yahooSymbol);
    if (series) {
      const { latest, prior } = selectLatestAndPrior(series.close, DEFAULT_LOOKBACK_DAYS);
      if (typeof latest === "number" && typeof prior === "number") {
        const timestamp = series.timestamp[series.timestamp.length - 1];
        const asOf = timestamp ? new Date(timestamp * 1000).toISOString() : nowIso;
        nextStoredQuotes[storeKey(index)] = {
          latest,
          prior,
          asOf
        };
        return toSnapshotItem({ index, latest, prior, asOf, dataState: "live" });
      }
    }

    const stored = store.quotes[storeKey(index)];
    if (stored && Number.isFinite(stored.latest) && Number.isFinite(stored.prior)) {
      return toSnapshotItem({
        index,
        latest: stored.latest,
        prior: stored.prior,
        asOf: stored.asOf || nowIso,
        dataState: "stale"
      });
    }

    return toSnapshotItem({
      index,
      latest: index.fallbackPrice,
      prior: index.fallbackPrice,
      asOf: nowIso,
      dataState: "fallback"
    });
  });

  await writeStore({
    savedAt: nowIso,
    quotes: nextStoredQuotes
  });

  return items;
}

