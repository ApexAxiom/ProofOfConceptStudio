import { RegionSlug } from "./regions.js";
import { MarketIndex, PortfolioDefinition } from "./types.js";
import { findPortfolioCatalogEntry, getPortfolioCatalog } from "./portfolio-catalog.js";

function toMarketIndex(portfolioSlug: string, index: {
  symbol: string;
  name: string;
  sourceUrl: string;
  regions: RegionSlug[];
}): MarketIndex {
  const safeSymbol = index.symbol.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return {
    id: `${portfolioSlug}-${safeSymbol}`,
    label: index.name,
    url: index.sourceUrl,
    notes: `${index.symbol} benchmark`,
    regionScope: index.regions
  };
}

export const PORTFOLIOS: PortfolioDefinition[] = getPortfolioCatalog().map((entry) => ({
  slug: entry.slug,
  label: entry.label,
  description: entry.description,
  defaultIndices: entry.indices.map((index) =>
    toMarketIndex(entry.slug, {
      symbol: index.symbol,
      name: index.name,
      sourceUrl: index.sourceUrl,
      regions: entry.regions
    })
  )
}));

/**
 * Returns a normalized portfolio slug if found.
 */
export function normalizePortfolio(slug: string): string | undefined {
  const hit = PORTFOLIOS.find((p) => p.slug === slug);
  return hit?.slug;
}

export function portfolioLabel(slug: string): string {
  return PORTFOLIOS.find((p) => p.slug === slug)?.label ?? slug;
}

export function findPortfolio(slug: string): PortfolioDefinition | undefined {
  return PORTFOLIOS.find((p) => p.slug === slug);
}

export function indicesForRegion(portfolioSlug: string, region: RegionSlug): MarketIndex[] {
  const catalogEntry = findPortfolioCatalogEntry(portfolioSlug);
  if (!catalogEntry) return [];
  if (!catalogEntry.regions.includes(region)) return [];
  const base = findPortfolio(portfolioSlug)?.defaultIndices ?? [];
  return base.filter((i) => i.regionScope.includes(region));
}

