/**
 * Category-specific market indices mapping.
 * Each category has its own set of relevant market benchmarks.
 */

import { CategoryGroup } from "./category.js";

export interface CategoryIndex {
  symbol: string;
  yahooSymbol: string;
  name: string;
  unit: string;
  fallbackPrice: number;
  sourceUrl: string;
}

// Energy category indices - Oil, Gas, LNG focused
const energyIndices: CategoryIndex[] = [
  { symbol: "WTI", yahooSymbol: "CL=F", name: "WTI Crude", unit: "/barrel", fallbackPrice: 71.23, sourceUrl: "https://finance.yahoo.com/quote/CL=F" },
  { symbol: "BRENT", yahooSymbol: "BZ=F", name: "Brent Crude", unit: "/barrel", fallbackPrice: 74.89, sourceUrl: "https://finance.yahoo.com/quote/BZ=F" },
  { symbol: "NATGAS", yahooSymbol: "NG=F", name: "Natural Gas (Henry Hub)", unit: "/MMBtu", fallbackPrice: 3.12, sourceUrl: "https://finance.yahoo.com/quote/NG=F" },
  { symbol: "LNG", yahooSymbol: "LNG", name: "Cheniere Energy (LNG proxy)", unit: "", fallbackPrice: 185.50, sourceUrl: "https://finance.yahoo.com/quote/LNG" },
];

// Steel & Materials category indices
const steelIndices: CategoryIndex[] = [
  { symbol: "HRC", yahooSymbol: "HRC=F", name: "HRC Steel Futures", unit: "/ton", fallbackPrice: 742.50, sourceUrl: "https://www.cmegroup.com/markets/metals/ferrous/hrc-steel.html" },
  { symbol: "COPPER", yahooSymbol: "HG=F", name: "Copper", unit: "/lb", fallbackPrice: 3.85, sourceUrl: "https://finance.yahoo.com/quote/HG=F" },
  { symbol: "IRON", yahooSymbol: "TIO=F", name: "Iron Ore", unit: "/tonne", fallbackPrice: 108.50, sourceUrl: "https://finance.yahoo.com/quote/TIO=F" },
  { symbol: "ALUM", yahooSymbol: "ALI=F", name: "Aluminum", unit: "/lb", fallbackPrice: 1.12, sourceUrl: "https://finance.yahoo.com/quote/ALI=F" },
];

// Freight & Logistics category indices
const freightIndices: CategoryIndex[] = [
  { symbol: "BDRY", yahooSymbol: "BDRY", name: "Dry Bulk Shipping (BDRY)", unit: "", fallbackPrice: 0, sourceUrl: "https://finance.yahoo.com/quote/BDRY" },
  { symbol: "WTI", yahooSymbol: "CL=F", name: "WTI Crude (fuel costs)", unit: "/barrel", fallbackPrice: 71.23, sourceUrl: "https://finance.yahoo.com/quote/CL=F" },
  { symbol: "FDX", yahooSymbol: "FDX", name: "FedEx (logistics proxy)", unit: "", fallbackPrice: 285.00, sourceUrl: "https://finance.yahoo.com/quote/FDX" },
  { symbol: "UPS", yahooSymbol: "UPS", name: "UPS (logistics proxy)", unit: "", fallbackPrice: 142.00, sourceUrl: "https://finance.yahoo.com/quote/UPS" },
];

// Professional Services category indices
const servicesIndices: CategoryIndex[] = [
  { symbol: "ACN", yahooSymbol: "ACN", name: "Accenture", unit: "", fallbackPrice: 345.00, sourceUrl: "https://finance.yahoo.com/quote/ACN" },
  { symbol: "ADP", yahooSymbol: "ADP", name: "ADP (HR proxy)", unit: "", fallbackPrice: 245.00, sourceUrl: "https://finance.yahoo.com/quote/ADP" },
  { symbol: "SPX", yahooSymbol: "^GSPC", name: "S&P 500", unit: "pts", fallbackPrice: 5125, sourceUrl: "https://finance.yahoo.com/quote/%5EGSPC" },
];

// IT & Cyber category indices
const cyberIndices: CategoryIndex[] = [
  { symbol: "PANW", yahooSymbol: "PANW", name: "Palo Alto Networks", unit: "", fallbackPrice: 320.00, sourceUrl: "https://finance.yahoo.com/quote/PANW" },
  { symbol: "CRWD", yahooSymbol: "CRWD", name: "CrowdStrike", unit: "", fallbackPrice: 285.00, sourceUrl: "https://finance.yahoo.com/quote/CRWD" },
  { symbol: "ZS", yahooSymbol: "ZS", name: "Zscaler", unit: "", fallbackPrice: 195.00, sourceUrl: "https://finance.yahoo.com/quote/ZS" },
  { symbol: "MSFT", yahooSymbol: "MSFT", name: "Microsoft", unit: "", fallbackPrice: 420.00, sourceUrl: "https://finance.yahoo.com/quote/MSFT" },
];

// Facilities category indices
const facilityIndices: CategoryIndex[] = [
  { symbol: "WM", yahooSymbol: "WM", name: "Waste Management", unit: "", fallbackPrice: 185.00, sourceUrl: "https://finance.yahoo.com/quote/WM" },
  { symbol: "RSG", yahooSymbol: "RSG", name: "Republic Services", unit: "", fallbackPrice: 175.00, sourceUrl: "https://finance.yahoo.com/quote/RSG" },
  { symbol: "NATGAS", yahooSymbol: "NG=F", name: "Natural Gas (utilities)", unit: "/MMBtu", fallbackPrice: 3.12, sourceUrl: "https://finance.yahoo.com/quote/NG=F" },
];

export const CATEGORY_INDICES: Record<CategoryGroup, CategoryIndex[]> = {
  energy: energyIndices,
  steel: steelIndices,
  freight: freightIndices,
  services: servicesIndices,
  cyber: cyberIndices,
  facility: facilityIndices,
};

export function getIndicesForCategory(category: CategoryGroup): CategoryIndex[] {
  return CATEGORY_INDICES[category] ?? energyIndices;
}

