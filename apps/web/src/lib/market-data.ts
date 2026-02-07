import { promises as fs } from "node:fs";
import path from "node:path";
import { getPortfolioCatalog, getPortfolioIndices, PortfolioIndex, isPlaceholdersAllowed } from "@proof/shared";

export type MarketQuoteState = "live" | "stale" | "fallback";

export interface MarketQuote {
  symbol: string;
  name: string;
  yahooSymbol: string;
  unit: string;
  sourceUrl: string;
  price: number;
  change: number;
  changePercent: number;
  lastUpdated: string;
  state: MarketQuoteState;
}

export interface MarketSnapshot {
  quotes: MarketQuote[];
  generatedAt: string;
  source: "live" | "mixed" | "fallback";
  liveCount: number;
  staleCount: number;
  fallbackCount: number;
}

interface StoredQuote {
  price: number;
  change: number;
  changePercent: number;
  lastUpdated: string;
}

interface MarketStore {
  savedAt: string;
  quotes: Record<string, StoredQuote>;
}

interface YahooQuote {
  price: number;
  change: number;
  changePercent: number;
  lastUpdated: string;
}

const CACHE_DIR = path.join(process.cwd(), ".cache");
const CACHE_FILE = path.join(CACHE_DIR, "market-quotes.json");
const RETRY_BACKOFF_MS = [300, 900, 1800];
const MARKET_TIME_ZONE = "America/Chicago";
const SNAPSHOT_HOURS = [9, 12, 16];

const EXECUTIVE_SYMBOL_ORDER = [
  "WTI",
  "BRENT",
  "NG",
  "HRC",
  "COPPER",
  "BDI",
  "AUDUSD",
  "DXY",
  "SPX"
];

const EXTRA_EXECUTIVE_QUOTES: PortfolioIndex[] = [
  {
    symbol: "AUDUSD",
    name: "AUD/USD",
    yahooSymbol: "AUDUSD=X",
    unit: "",
    fallbackPrice: 0.65,
    sourceUrl: "https://finance.yahoo.com/quote/AUDUSD=X"
  },
  {
    symbol: "DXY",
    name: "US Dollar Index",
    yahooSymbol: "DX-Y.NYB",
    unit: "pts",
    fallbackPrice: 105.2,
    sourceUrl: "https://finance.yahoo.com/quote/DX-Y.NYB"
  },
  {
    symbol: "SPX",
    name: "S&P 500",
    yahooSymbol: "^GSPC",
    unit: "pts",
    fallbackPrice: 5400,
    sourceUrl: "https://finance.yahoo.com/quote/%5EGSPC"
  }
];

const QUOTE_DEFINITIONS: PortfolioIndex[] = (() => {
  const byKey = new Map<string, PortfolioIndex>();
  for (const entry of getPortfolioCatalog()) {
    for (const index of entry.indices) {
      const key = `${index.symbol}:${index.yahooSymbol}`;
      if (!byKey.has(key)) {
        byKey.set(key, index);
      }
    }
  }
  for (const index of EXTRA_EXECUTIVE_QUOTES) {
    const key = `${index.symbol}:${index.yahooSymbol}`;
    if (!byKey.has(key)) {
      byKey.set(key, index);
    }
  }
  return Array.from(byKey.values());
})();

let memoryCache: { snapshot: MarketSnapshot; refreshedAtMs: number; windowKey: string } | null = null;

function nowIso(): string {
  return new Date().toISOString();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return fallback;
}

function getTimeZoneParts(date: Date, timeZone: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
  const parts = formatter.formatToParts(date);
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(lookup.year),
    month: Number(lookup.month),
    day: Number(lookup.day),
    hour: Number(lookup.hour),
    minute: Number(lookup.minute),
    second: Number(lookup.second)
  };
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = getTimeZoneParts(date, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - date.getTime();
}

function toUtcMsForLocalTime(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): number {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const offset = getTimeZoneOffsetMs(utcGuess, timeZone);
  return utcGuess.getTime() - offset;
}

function getSnapshotWindowKey(date: Date): string {
  const nowMs = date.getTime();
  const parts = getTimeZoneParts(date, MARKET_TIME_ZONE);
  const [morningHour, noonHour, closeHour] = SNAPSHOT_HOURS;
  const morningMs = toUtcMsForLocalTime(parts.year, parts.month, parts.day, morningHour, 0, MARKET_TIME_ZONE);
  const noonMs = toUtcMsForLocalTime(parts.year, parts.month, parts.day, noonHour, 0, MARKET_TIME_ZONE);
  const closeMs = toUtcMsForLocalTime(parts.year, parts.month, parts.day, closeHour, 0, MARKET_TIME_ZONE);

  if (nowMs >= closeMs) return `${parts.year}-${parts.month}-${parts.day}-close`;
  if (nowMs >= noonMs) return `${parts.year}-${parts.month}-${parts.day}-noon`;
  if (nowMs >= morningMs) return `${parts.year}-${parts.month}-${parts.day}-morning`;

  const middayMs = toUtcMsForLocalTime(parts.year, parts.month, parts.day, 12, 0, MARKET_TIME_ZONE);
  const previousDayParts = getTimeZoneParts(new Date(middayMs - 24 * 60 * 60 * 1000), MARKET_TIME_ZONE);
  return `${previousDayParts.year}-${previousDayParts.month}-${previousDayParts.day}-close`;
}

async function readStore(): Promise<MarketStore | null> {
  try {
    const raw = await fs.readFile(CACHE_FILE, "utf-8");
    const parsed = JSON.parse(raw) as MarketStore;
    if (!parsed || typeof parsed !== "object" || !parsed.quotes) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeStore(store: MarketStore): Promise<void> {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(CACHE_FILE, JSON.stringify(store, null, 2), "utf-8");
  } catch {
    // Ignore persistence failures and continue with in-memory cache.
  }
}

async function fetchYahooQuotes(symbols: string[]): Promise<Map<string, YahooQuote>> {
  const uniqueSymbols = Array.from(new Set(symbols)).filter(Boolean);
  const quotes = new Map<string, YahooQuote>();
  if (uniqueSymbols.length === 0) return quotes;

  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(uniqueSymbols.join(","))}`;

  for (let attempt = 0; attempt < RETRY_BACKOFF_MS.length; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; ProofOfConceptStudio/1.0)",
          Accept: "application/json"
        },
        cache: "no-store"
      });
      if (!response.ok) {
        if (attempt < RETRY_BACKOFF_MS.length - 1) {
          await sleep(RETRY_BACKOFF_MS[attempt]);
          continue;
        }
        return quotes;
      }

      const json = await response.json();
      const result = json?.quoteResponse?.result as Array<Record<string, unknown>>;
      if (!Array.isArray(result)) return quotes;

      for (const row of result) {
        const symbol = typeof row.symbol === "string" ? row.symbol : "";
        const price = asNumber(row.regularMarketPrice, 0);
        if (!symbol || price <= 0) continue;
        const marketTime = asNumber(row.regularMarketTime, 0);
        quotes.set(symbol, {
          price,
          change: asNumber(row.regularMarketChange, 0),
          changePercent: asNumber(row.regularMarketChangePercent, 0),
          lastUpdated: marketTime > 0 ? new Date(marketTime * 1000).toISOString() : nowIso()
        });
      }

      return quotes;
    } catch {
      if (attempt < RETRY_BACKOFF_MS.length - 1) {
        await sleep(RETRY_BACKOFF_MS[attempt]);
      }
    }
  }

  return quotes;
}

function roundQuote(quote: StoredQuote): StoredQuote {
  return {
    price: Number(quote.price.toFixed(4)),
    change: Number(quote.change.toFixed(4)),
    changePercent: Number(quote.changePercent.toFixed(4)),
    lastUpdated: quote.lastUpdated
  };
}

function fallbackQuote(index: PortfolioIndex, generatedAt: string): StoredQuote {
  return {
    price: index.fallbackPrice,
    change: 0,
    changePercent: 0,
    lastUpdated: generatedAt
  };
}

function storeKey(index: PortfolioIndex): string {
  return `${index.symbol}:${index.yahooSymbol}`;
}

async function refreshSnapshot(): Promise<MarketSnapshot> {
  const generatedAt = nowIso();
  const windowKey = getSnapshotWindowKey(new Date(generatedAt));
  const store = (await readStore()) ?? { savedAt: generatedAt, quotes: {} };
  const liveBySymbol = await fetchYahooQuotes(QUOTE_DEFINITIONS.map((index) => index.yahooSymbol));
  const nextStoredQuotes: Record<string, StoredQuote> = { ...store.quotes };
  const placeholdersAllowed = isPlaceholdersAllowed();

  const quotes: MarketQuote[] = QUOTE_DEFINITIONS.map((index) => {
    const live = liveBySymbol.get(index.yahooSymbol);
    const key = storeKey(index);
    const stored = store.quotes[key];

    let state: MarketQuoteState = "fallback";
    let selected: StoredQuote;

    if (live) {
      state = "live";
      selected = roundQuote(live);
      nextStoredQuotes[key] = selected;
    } else if (stored) {
      state = "stale";
      selected = roundQuote(stored);
    } else {
      if (!placeholdersAllowed) return null;
      state = "fallback";
      selected = fallbackQuote(index, generatedAt);
    }

    return {
      symbol: index.symbol,
      name: index.name,
      yahooSymbol: index.yahooSymbol,
      unit: index.unit,
      sourceUrl: index.sourceUrl,
      price: selected.price,
      change: selected.change,
      changePercent: selected.changePercent,
      lastUpdated: selected.lastUpdated,
      state
    };
  }).filter((quote): quote is MarketQuote => Boolean(quote));

  await writeStore({
    savedAt: generatedAt,
    quotes: nextStoredQuotes
  });

  const liveCount = quotes.filter((quote) => quote.state === "live").length;
  const staleCount = quotes.filter((quote) => quote.state === "stale").length;
  const fallbackCount = quotes.filter((quote) => quote.state === "fallback").length;
  const source: MarketSnapshot["source"] =
    liveCount === quotes.length ? "live" : liveCount > 0 || staleCount > 0 ? "mixed" : "fallback";

  const snapshot: MarketSnapshot = {
    quotes,
    generatedAt,
    source,
    liveCount,
    staleCount,
    fallbackCount
  };

  memoryCache = {
    snapshot,
    refreshedAtMs: Date.now(),
    windowKey
  };

  return snapshot;
}

export async function getMarketSnapshot(): Promise<MarketSnapshot> {
  const now = new Date();
  const currentWindowKey = getSnapshotWindowKey(now);
  if (!memoryCache) {
    return refreshSnapshot();
  }

  if (memoryCache.windowKey !== currentWindowKey) {
    return refreshSnapshot();
  }

  return memoryCache.snapshot;
}

function quoteForIndex(index: PortfolioIndex, snapshot: MarketSnapshot): MarketQuote | null {
  const byExactKey = snapshot.quotes.find(
    (quote) => quote.symbol === index.symbol && quote.yahooSymbol === index.yahooSymbol
  );
  if (byExactKey) return byExactKey;
  const bySymbol = snapshot.quotes.find((quote) => quote.symbol === index.symbol);
  if (bySymbol) return bySymbol;
  if (!isPlaceholdersAllowed()) return null;
  const generatedAt = snapshot.generatedAt;
  return {
    symbol: index.symbol,
    name: index.name,
    yahooSymbol: index.yahooSymbol,
    unit: index.unit,
    sourceUrl: index.sourceUrl,
    price: index.fallbackPrice,
    change: 0,
    changePercent: 0,
    lastUpdated: generatedAt,
    state: "fallback"
  };
}

export async function getPortfolioMarketQuotes(portfolioSlug: string): Promise<{
  quotes: MarketQuote[];
  generatedAt: string;
  source: MarketSnapshot["source"];
}> {
  const snapshot = await getMarketSnapshot();
  const portfolioIndices = getPortfolioIndices(portfolioSlug);
  const quotes = portfolioIndices.map((index) => quoteForIndex(index, snapshot)).filter((quote): quote is MarketQuote => Boolean(quote));
  return {
    quotes,
    generatedAt: snapshot.generatedAt,
    source: snapshot.source
  };
}

export async function getExecutiveMarketQuotes(): Promise<{
  quotes: MarketQuote[];
  generatedAt: string;
  source: MarketSnapshot["source"];
}> {
  const snapshot = await getMarketSnapshot();
  const ordered = EXECUTIVE_SYMBOL_ORDER.map((symbol) =>
    snapshot.quotes.find((quote) => quote.symbol === symbol)
  ).filter((quote): quote is MarketQuote => Boolean(quote));

  return {
    quotes: ordered,
    generatedAt: snapshot.generatedAt,
    source: snapshot.source
  };
}
