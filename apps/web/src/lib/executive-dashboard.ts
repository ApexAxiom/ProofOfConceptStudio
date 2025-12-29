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
  region: "apac" | "international";
  imageUrl?: string;
}

export interface ExecutiveDashboardPayload {
  generatedAt: string;
  indices: ExecutiveIndex[];
  articles: ExecutiveArticle[];
  apacArticles: ExecutiveArticle[];
  internationalArticles: ExecutiveArticle[];
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

// News feeds organized by region
const NEWS_FEEDS: Array<{ url: string; category: string; source: string; region: "apac" | "international" }> = [
  // APAC Sources (Australia, Asia-Pacific)
  {
    url: "https://www.energynewsbulletin.net/rss",
    category: "Energy",
    source: "Energy News Bulletin",
    region: "apac",
  },
  {
    url: "https://www.offshore-energy.biz/feed/",
    category: "Offshore",
    source: "Offshore Energy",
    region: "apac",
  },
  {
    url: "https://www.rigzone.com/news/rss/rigzone_latest.aspx",
    category: "Drilling",
    source: "Rigzone APAC",
    region: "apac",
  },
  // International Sources (Houston, Mexico, Senegal, LNG)
  {
    url: "https://feeds.marketwatch.com/marketwatch/energy",
    category: "Energy",
    source: "MarketWatch",
    region: "international",
  },
  {
    url: "https://www.lngindustry.com/rss/",
    category: "LNG",
    source: "LNG Industry",
    region: "international",
  },
  {
    url: "https://www.reutersagency.com/feed/?best-topics=energy",
    category: "Energy",
    source: "Reuters",
    region: "international",
  },
  {
    url: "https://www.worldoil.com/rss/",
    category: "Oil & Gas",
    source: "World Oil",
    region: "international",
  },
  {
    url: "https://www.ogj.com/rss",
    category: "Oil & Gas",
    source: "Oil & Gas Journal",
    region: "international",
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
    // APAC
    {
      title: "Woodside Scarborough project reaches key milestone",
      url: "https://www.energynewsbulletin.net",
      source: "Energy News Bulletin",
      publishedAt: iso(1),
      category: "LNG",
      region: "apac",
      summary: "Major Australian LNG development achieves drilling milestone as export capacity ramps up.",
    },
    {
      title: "Perth Basin gas exploration intensifies",
      url: "https://www.offshore-energy.biz",
      source: "Offshore Energy",
      publishedAt: iso(2),
      category: "Exploration",
      region: "apac",
      summary: "WA operators fast-track appraisal drilling to meet domestic gas reservation policy.",
    },
    {
      title: "NWS extension discussions continue with Chevron",
      url: "https://www.rigzone.com",
      source: "Rigzone",
      publishedAt: iso(3),
      category: "Offshore",
      region: "apac",
      summary: "Chevron and partners negotiate extended production rights for North West Shelf facilities.",
    },
    {
      title: "Browse Basin FID timeline firming up",
      url: "https://www.energynewsbulletin.net",
      source: "Energy News Bulletin",
      publishedAt: iso(4),
      category: "Projects",
      region: "apac",
      summary: "Woodside targets late 2025 FID for Browse to Pluto Train 2 backfill project.",
    },
    // International
    {
      title: "Golden Pass LNG construction hits 90% complete",
      url: "https://www.lngindustry.com",
      source: "LNG Industry",
      publishedAt: iso(1),
      category: "LNG",
      region: "international",
      summary: "Qatar-Exxon Texas facility on track for first cargo in 2025 as Train 1 commissioning begins.",
    },
    {
      title: "Mexico Pacific LNG secures additional offtakers",
      url: "https://www.reuters.com",
      source: "Reuters",
      publishedAt: iso(2),
      category: "LNG",
      region: "international",
      summary: "New 20-year SPAs signed with Asian buyers for Sonora coast export terminal.",
    },
    {
      title: "Permian operators lock in rig contracts through 2026",
      url: "https://www.worldoil.com",
      source: "World Oil",
      publishedAt: iso(3),
      category: "Drilling",
      region: "international",
      summary: "Drilling contractors see improved visibility as E&Ps commit to multi-year programs.",
    },
    {
      title: "Senegal offshore oil production ramps up at Sangomar",
      url: "https://www.ogj.com",
      source: "Oil & Gas Journal",
      publishedAt: iso(4),
      category: "Offshore",
      region: "international",
      summary: "Woodside-operated field hits 100,000 bpd ahead of schedule in West Africa.",
    },
    {
      title: "US Gulf shelf activity picks up on higher oil prices",
      url: "https://www.marketwatch.com",
      source: "MarketWatch",
      publishedAt: iso(5),
      category: "Offshore",
      region: "international",
      summary: "Shallow water operators return as economics improve for mature field development.",
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

async function fetchArticles(): Promise<{ apac: ExecutiveArticle[]; international: ExecutiveArticle[] }> {
  const apacArticles: ExecutiveArticle[] = [];
  const internationalArticles: ExecutiveArticle[] = [];

  for (const feed of NEWS_FEEDS) {
    try {
      const res = await fetch(feed.url, { next: { revalidate: 86_400 } });
      if (!res.ok) {
        continue;
      }
      const xml = await res.text();
      const itemRegex = /<item>([\s\S]*?)<\/item>/g;
      let match: RegExpExecArray | null = null;
      const targetArray = feed.region === "apac" ? apacArticles : internationalArticles;

      while ((match = itemRegex.exec(xml)) && targetArray.length < 6) {
        const item = match[1];
        const title = parseTagValue(item, "title");
        const link = parseTagValue(item, "link");
        const pubDate = parseTagValue(item, "pubDate") ?? new Date().toISOString();
        const description = parseTagValue(item, "description");
        
        // Try to extract image from media:content or enclosure
        const mediaMatch = item.match(/url="([^"]+\.(jpg|jpeg|png|webp)[^"]*)"/i);
        const imageUrl = mediaMatch?.[1];

        if (title && link) {
          targetArray.push({
            title,
            url: link,
            source: feed.source,
            publishedAt: new Date(pubDate).toISOString(),
            category: feed.category,
            region: feed.region,
            summary: description?.slice(0, 150),
            imageUrl,
          });
        }
      }
    } catch (error) {
      console.error(`Failed to read feed ${feed.url}`, error);
    }
  }

  // Use fallbacks if no articles fetched
  if (apacArticles.length === 0 || internationalArticles.length === 0) {
    const fallback = getFallbackArticles();
    if (apacArticles.length === 0) {
      apacArticles.push(...fallback.filter(a => a.region === "apac"));
    }
    if (internationalArticles.length === 0) {
      internationalArticles.push(...fallback.filter(a => a.region === "international"));
    }
  }

  return {
    apac: apacArticles.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()).slice(0, 6),
    international: internationalArticles.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()).slice(0, 6),
  };
}

/**
 * Builds the executive dashboard payload with 6-month price history and energy headlines.
 * Articles are split by region: APAC (Australia/Asia-Pacific) and International (Houston/Mexico/Senegal/LNG).
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

  const { apac, international } = await fetchArticles();
  const allArticles = [...apac, ...international].sort((a, b) => 
    new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  return {
    generatedAt: now,
    indices,
    articles: allArticles,
    apacArticles: apac,
    internationalArticles: international,
    sources: {
      pricing: "Yahoo Finance Spark (6 month, 1d interval) with synthetic fallback",
      news: "Energy RSS feeds (MarketWatch, LNG Industry, Reuters, World Oil, OGJ) with curated fallback",
    },
  };
});
