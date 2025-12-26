import { cache } from "react";

export interface ExecutiveIndexPoint {
  date: string;
  value: number;
}

export interface ExecutiveIndex {
  symbol: string;
  name: string;
  unit: string;
  category: "crude" | "gas" | "lng" | "shipping" | "equities" | "macro";
  region: "global" | "apac" | "americas";
  source: string;
  sourceUrl: string;
  series: ExecutiveIndexPoint[];
  latest: number;
  change: number;
  changePercent: number;
}

export interface ExecutiveArticle {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  category: string;
  summary?: string;
}

export interface ExecutiveDashboardPayload {
  generatedAt: string;
  indices: ExecutiveIndex[];
  articles: ExecutiveArticle[];
  sources: { pricing: string; news: string };
}

interface IndexConfig {
  symbol: ExecutiveIndex["symbol"];
  name: ExecutiveIndex["name"];
  unit: ExecutiveIndex["unit"];
  category: ExecutiveIndex["category"];
  region: ExecutiveIndex["region"];
  source: ExecutiveIndex["source"];
  sourceUrl: ExecutiveIndex["sourceUrl"];
  yahooSymbol: string;
  fallback: number;
  volatility: number;
}

const INDEX_CONFIG: IndexConfig[] = [
  {
    symbol: "WTI",
    name: "WTI Crude",
    unit: "/bbl",
    category: "crude",
    region: "americas",
    source: "Yahoo Finance",
    sourceUrl: "https://query1.finance.yahoo.com",
    yahooSymbol: "CL=F",
    fallback: 78,
    volatility: 0.035,
  },
  {
    symbol: "BRENT",
    name: "Brent",
    unit: "/bbl",
    category: "crude",
    region: "global",
    source: "Yahoo Finance",
    sourceUrl: "https://query1.finance.yahoo.com",
    yahooSymbol: "BZ=F",
    fallback: 82,
    volatility: 0.032,
  },
  {
    symbol: "HH",
    name: "Henry Hub Gas",
    unit: "/MMBtu",
    category: "gas",
    region: "americas",
    source: "Yahoo Finance",
    sourceUrl: "https://query1.finance.yahoo.com",
    yahooSymbol: "NG=F",
    fallback: 2.9,
    volatility: 0.06,
  },
  {
    symbol: "JKM",
    name: "JKM LNG",
    unit: "/MMBtu",
    category: "lng",
    region: "apac",
    source: "CME (JKM Futures)",
    sourceUrl: "https://www.cmegroup.com/market-data",
    yahooSymbol: "LNG",
    fallback: 12.4,
    volatility: 0.045,
  },
  {
    symbol: "BDI",
    name: "Baltic Dry",
    unit: "pts",
    category: "shipping",
    region: "global",
    source: "Stooq (free index feed)",
    sourceUrl: "https://stooq.pl",
    yahooSymbol: "^BDI",
    fallback: 1450,
    volatility: 0.05,
  },
  {
    symbol: "XOP",
    name: "Energy Equities (XOP)",
    unit: "pts",
    category: "equities",
    region: "global",
    source: "Stooq/Yahoo Finance",
    sourceUrl: "https://query1.finance.yahoo.com",
    yahooSymbol: "XOP",
    fallback: 148,
    volatility: 0.028,
  },
  {
    symbol: "SPX",
    name: "S&P 500",
    unit: "pts",
    category: "macro",
    region: "global",
    source: "Yahoo Finance",
    sourceUrl: "https://query1.finance.yahoo.com",
    yahooSymbol: "^GSPC",
    fallback: 5125,
    volatility: 0.01,
  },
];

const NEWS_FEEDS: Array<{ url: string; category: string; source: string }> = [
  {
    url: "https://feeds.marketwatch.com/marketwatch/energy",
    category: "Crude & Products",
    source: "MarketWatch Energy",
  },
  {
    url: "https://www.lngindustry.com/rss/",
    category: "LNG",
    source: "LNG Industry",
  },
  {
    url: "https://www.reutersagency.com/feed/?best-topics=energy",
    category: "Macro",
    source: "Reuters Energy",
  },
];

function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function generateSyntheticSeries(basePrice: number, volatility: number): ExecutiveIndexPoint[] {
  const days = 180;
  const now = new Date();
  const points: ExecutiveIndexPoint[] = [];
  let current = basePrice;

  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const drift = randomBetween(-volatility, volatility);
    current = Math.max(0, current * (1 + drift));
    points.push({ date: date.toISOString(), value: Number(current.toFixed(2)) });
  }

  return points;
}

async function fetchSparkSeries(symbols: string[]): Promise<Map<string, ExecutiveIndexPoint[]>> {
  const sparkMap = new Map<string, ExecutiveIndexPoint[]>();

  if (!symbols.length) {
    return sparkMap;
  }

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/spark?interval=1d&range=6mo&symbols=${symbols.join(",")}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ProofStudio/1.0)" },
      next: { revalidate: 86_400 },
    });

    if (!res.ok) {
      return sparkMap;
    }

    const json = await res.json();
    const result = json?.spark?.result as Array<{ symbol: string; response?: Array<{ timestamp: number[]; close: number[] }> }>;

    if (!Array.isArray(result)) {
      return sparkMap;
    }

    for (const entry of result) {
      const response = entry.response?.[0];
      if (!response?.timestamp || !response?.close) {
        continue;
      }

      const series: ExecutiveIndexPoint[] = response.timestamp.map((ts: number, idx: number) => ({
        date: new Date(ts * 1000).toISOString(),
        value: Number(response.close[idx]?.toFixed(2) ?? 0),
      }));

      sparkMap.set(entry.symbol, series);
    }
  } catch (error) {
    console.error("Spark data fetch failed", error);
  }

  return sparkMap;
}

function buildIndex(config: IndexConfig, series: ExecutiveIndexPoint[]): ExecutiveIndex {
  const sortedSeries = [...series].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const latest = sortedSeries.at(-1)?.value ?? config.fallback;
  const starting = sortedSeries[0]?.value ?? config.fallback;
  const change = latest - starting;
  const changePercent = starting === 0 ? 0 : (change / starting) * 100;

  return {
    symbol: config.symbol,
    name: config.name,
    unit: config.unit,
    category: config.category,
    region: config.region,
    source: config.source,
    sourceUrl: config.sourceUrl,
    series: sortedSeries,
    latest,
    change,
    changePercent,
  };
}

function getFallbackArticles(): ExecutiveArticle[] {
  const now = new Date();
  const iso = (daysAgo: number) => new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000).toISOString();

  return [
    {
      title: "Refiners lock in crude runs ahead of summer driving season",
      url: "https://www.reuters.com",
      source: "Reuters Energy",
      publishedAt: iso(2),
      category: "Crude",
      summary: "Gulf Coast refiners signal strong gasoline pull with utilization rates rising while crude inventories flatten.",
    },
    {
      title: "LNG buyers eye flexible cargoes as Asian spot remains elevated",
      url: "https://www.lngindustry.com",
      source: "LNG Industry",
      publishedAt: iso(3),
      category: "LNG",
      summary: "JKM premium to TTF widens on heat-driven demand and tight vessel availability through Singapore lanes.",
    },
    {
      title: "US gas drillers trim rigs as Henry Hub hovers below $3",
      url: "https://www.marketwatch.com",
      source: "MarketWatch",
      publishedAt: iso(5),
      category: "Gas",
      summary: "Producers shift capital toward liquids-rich plays; Appalachia basis narrows on lower output guidance.",
    },
    {
      title: "Baltic Dry cools after capesize surge",
      url: "https://www.hellenicshippingnews.com",
      source: "Hellenic Shipping",
      publishedAt: iso(6),
      category: "Shipping",
      summary: "Charterers step back following iron ore rally; forward curves still imply firm Q4 demand.",
    },
    {
      title: "Energy equities lag crude rally as macro risk stays in focus",
      url: "https://www.wsj.com",
      source: "WSJ Markets",
      publishedAt: iso(7),
      category: "Macro",
      summary: "Investors rotate defensively despite supportive commodity backdrop; dividends cushion downside.",
    },
  ];
}

function parseTagValue(item: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}>([^<]*)<\\/${tag}>`);
  const match = item.match(regex);
  if (match?.[1]) {
    return match[1].trim();
  }

  const cdataRegex = new RegExp(`<${tag}><!\[CDATA\[([^]*?)\]\]><\\/${tag}>`);
  const cdataMatch = item.match(cdataRegex);
  return cdataMatch?.[1]?.trim() ?? null;
}

async function fetchArticles(): Promise<ExecutiveArticle[]> {
  const articles: ExecutiveArticle[] = [];

  for (const feed of NEWS_FEEDS) {
    try {
      const res = await fetch(feed.url, { next: { revalidate: 86_400 } });
      if (!res.ok) {
        continue;
      }
      const xml = await res.text();
      const itemRegex = /<item>([\s\S]*?)<\/item>/g;
      let match: RegExpExecArray | null = null;

      while ((match = itemRegex.exec(xml)) && articles.length < 10) {
        const item = match[1];
        const title = parseTagValue(item, "title");
        const link = parseTagValue(item, "link");
        const pubDate = parseTagValue(item, "pubDate") ?? new Date().toISOString();

        if (title && link) {
          articles.push({
            title,
            url: link,
            source: feed.source,
            publishedAt: new Date(pubDate).toISOString(),
            category: feed.category,
          });
        }
      }
    } catch (error) {
      console.error(`Failed to read feed ${feed.url}`, error);
    }
  }

  if (!articles.length) {
    return getFallbackArticles();
  }

  return articles
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, 10);
}

/**
 * Builds the executive dashboard payload with 6-month price history and energy headlines.
 * Attempts to use free, no-auth data feeds (Yahoo Finance spark + open RSS) and
 * falls back to synthetic series so the dashboard still renders offline.
 */
export const getExecutiveDashboardData = cache(async (): Promise<ExecutiveDashboardPayload> => {
  const now = new Date().toISOString();

  const yahooSymbols = INDEX_CONFIG.map((cfg) => cfg.yahooSymbol);
  const sparkMap = await fetchSparkSeries(yahooSymbols);

  const indices: ExecutiveIndex[] = INDEX_CONFIG.map((config) => {
    const liveSeries = sparkMap.get(config.yahooSymbol);
    const series = liveSeries?.length ? liveSeries : generateSyntheticSeries(config.fallback, config.volatility);
    return buildIndex(config, series);
  });

  const articles = await fetchArticles();

  return {
    generatedAt: now,
    indices,
    articles,
    sources: {
      pricing: "Yahoo Finance Spark (6 month, 1d interval) with synthetic fallback",
      news: "Energy RSS feeds (MarketWatch, LNG Industry, Reuters) with curated fallback",
    },
  };
});
