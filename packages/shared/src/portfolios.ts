import { MarketIndex, PortfolioDefinition } from "./types.js";
import { RegionSlug } from "./regions.js";

const energyIndices: MarketIndex[] = [
  {
    id: "eia-petroleum",
    label: "EIA Petroleum Prices",
    url: "https://www.eia.gov/petroleum/",
    notes: "Global crude price dashboards",
    regionScope: ["au", "us-mx-la-lng"]
  },
  {
    id: "cme-wti",
    label: "CME WTI Futures",
    url: "https://www.cmegroup.com/markets/energy/crude-oil/light-sweet-crude.html",
    notes: "NYMEX WTI futures",
    regionScope: ["au", "us-mx-la-lng"]
  },
  {
    id: "ice-brent",
    label: "ICE Brent Futures",
    url: "https://www.ice.com/products/219/Brent-Crude-Futures",
    notes: "Brent benchmark",
    regionScope: ["au", "us-mx-la-lng"]
  },
  {
    id: "aemo-gas",
    label: "AEMO Gas Bulletin Board",
    url: "https://aemo.com.au/en/energy-systems/gas/gas-bulletin-board-gbb",
    notes: "AU gas system view",
    regionScope: ["au"]
  },
  {
    id: "au-petroleum-stats",
    label: "Australian Petroleum Statistics",
    url: "https://www.energy.gov.au/energy-data/australian-petroleum-statistics",
    notes: "Monthly AU petroleum production/import/export/sales",
    regionScope: ["au"]
  },
  {
    id: "aemo-gsh-daily",
    label: "AEMO Gas Supply Hub (GSH) Daily Reports",
    url: "https://www.aemo.com.au/energy-systems/gas/gas-supply-hub-gsh/data-gsh/daily-gsh-reports",
    notes: "Wallumbilla benchmark prices and daily trading summary",
    regionScope: ["au"]
  },
  {
    id: "accc-lng-netback",
    label: "ACCC LNG Netback Price Series",
    url: "https://www.accc.gov.au/inquiries-and-consultations/gas-inquiry-2017-30/lng-netback-price-series",
    notes: "Netback linking LNG spot to Wallumbilla",
    regionScope: ["au"]
  },
  {
    id: "asx-gas-derivatives",
    label: "ASX Gas Derivatives (Wallumbilla/DWGM)",
    url: "https://www.asx.com.au/markets/trade-our-derivatives-market/overview/energy-derivatives/gas",
    notes: "AU gas futures resources",
    regionScope: ["au"]
  },
  {
    id: "eia-lng",
    label: "EIA LNG Snapshot",
    url: "https://www.eia.gov/naturalgas/",
    notes: "US LNG stats",
    regionScope: ["us-mx-la-lng", "au"]
  }
];

const steelIndices: MarketIndex[] = [
  {
    id: "cme-hrc",
    label: "CME HRC Steel",
    url: "https://www.cmegroup.com/markets/metals/ferrous/hrc-steel.html",
    notes: "US steel coil futures",
    regionScope: ["au", "us-mx-la-lng"]
  },
  {
    id: "lme-ferrous",
    label: "LME Ferrous",
    url: "https://www.lme.com/en/metals/ferrous",
    notes: "London Metal Exchange",
    regionScope: ["au", "us-mx-la-lng"]
  },
  {
    id: "steelbenchmarker",
    label: "SteelBenchmarker",
    url: "https://steelbenchmarker.com/",
    notes: "Global steel reference",
    regionScope: ["au", "us-mx-la-lng"]
  },
  {
    id: "afr-commodities",
    label: "AFR Commodities",
    url: "https://www.afr.com/markets/commodities",
    notes: "AU commodity coverage",
    regionScope: ["au"]
  },
  {
    id: "marketindex-commodities",
    label: "Market Index – Commodities",
    url: "https://www.marketindex.com.au/commodities",
    notes: "AU commodity snapshots",
    regionScope: ["au"]
  },
  {
    id: "sgx-iron-ore",
    label: "SGX Iron Ore Derivatives",
    url: "https://www.sgx.com/derivatives/products/iron-ore",
    notes: "APAC iron ore pricing references",
    regionScope: ["au"]
  },
  {
    id: "rba-fx",
    label: "RBA Exchange Rates",
    url: "https://www.rba.gov.au/statistics/frequency/exchange-rates.html",
    notes: "AUD FX reference rates",
    regionScope: ["au"]
  },
  {
    id: "spg-metals",
    label: "S&P Global Metals",
    url: "https://www.spglobal.com/commodityinsights/en/commodities/metals",
    notes: "Metals indices",
    regionScope: ["au", "us-mx-la-lng"]
  }
];

const freightIndices: MarketIndex[] = [
  {
    id: "baltic-exchange",
    label: "Baltic Exchange",
    url: "https://www.balticexchange.com/en/data-services/assessments.html",
    notes: "Dry bulk freight benchmark",
    regionScope: ["au", "us-mx-la-lng"]
  },
  {
    id: "freightos-fbx",
    label: "Freightos FBX",
    url: "https://www.freightos.com/freightos-baltic-index-fbx/",
    notes: "Container index",
    regionScope: ["au", "us-mx-la-lng"]
  },
  {
    id: "drewry",
    label: "Drewry Index",
    url: "https://www.drewry.co.uk/",
    notes: "Container spot rates",
    regionScope: ["au", "us-mx-la-lng"]
  },
  {
    id: "air-cargo",
    label: "Air Cargo News",
    url: "https://www.aircargonews.net/",
    notes: "Air freight sentiment",
    regionScope: ["au", "us-mx-la-lng"]
  },
  {
    id: "vertical-mag",
    label: "Vertical Magazine",
    url: "https://verticalmag.com/",
    notes: "Rotary aviation",
    regionScope: ["au", "us-mx-la-lng"]
  }
];

const servicesIndices: MarketIndex[] = [
  {
    id: "hiring-trends",
    label: "Hiring Pulse",
    url: "https://www.hrdive.com/",
    notes: "HR sentiment",
    regionScope: ["au", "us-mx-la-lng"]
  },
  {
    id: "consulting-index",
    label: "Consulting News",
    url: "https://www.consulting.us/news",
    notes: "Consulting pipeline",
    regionScope: ["au", "us-mx-la-lng"]
  },
  {
    id: "accounting-today",
    label: "Accounting Today",
    url: "https://www.accountingtoday.com/",
    notes: "Advisory trends",
    regionScope: ["au", "us-mx-la-lng"]
  },
  {
    id: "staffing-industry",
    label: "Staffing Rates",
    url: "https://www.staffingindustry.com/news/global-daily-news",
    notes: "Staffing market",
    regionScope: ["au", "us-mx-la-lng"]
  },
  {
    id: "hbr",
    label: "HBR Spotlight",
    url: "https://hbr.org/",
    notes: "Leadership research",
    regionScope: ["au", "us-mx-la-lng"]
  }
];

const cyberIndices: MarketIndex[] = [
  {
    id: "cisa-advisories",
    label: "CISA Advisories",
    url: "https://www.cisa.gov/news-events/cybersecurity-advisories",
    notes: "US advisories",
    regionScope: ["au", "us-mx-la-lng"]
  },
  {
    id: "acsc-alerts",
    label: "ACSC Alerts",
    url: "https://www.cyber.gov.au/about-us/view-all-content/alerts",
    notes: "AU cyber alerts",
    regionScope: ["au"]
  },
  {
    id: "cvss",
    label: "NVD CVEs",
    url: "https://nvd.nist.gov/vuln/full-listing",
    notes: "Severity tracker",
    regionScope: ["au", "us-mx-la-lng"]
  },
  {
    id: "cloudflare-radar",
    label: "Cloudflare Radar",
    url: "https://radar.cloudflare.com/",
    notes: "Traffic anomalies",
    regionScope: ["au", "us-mx-la-lng"]
  },
  {
    id: "msrc",
    label: "MSRC Releases",
    url: "https://msrc.microsoft.com/update-guide",
    notes: "Patch cadence",
    regionScope: ["au", "us-mx-la-lng"]
  }
];

const facilityIndices: MarketIndex[] = [
  {
    id: "osha",
    label: "OSHA News",
    url: "https://www.osha.gov/news/newsreleases",
    notes: "US safety notices",
    regionScope: ["us-mx-la-lng"]
  },
  {
    id: "safework-aus",
    label: "Safe Work Australia",
    url: "https://www.safeworkaustralia.gov.au/news-and-events",
    notes: "AU safety alerts",
    regionScope: ["au"]
  },
  {
    id: "ifma-insights",
    label: "IFMA Insights",
    url: "https://www.ifma.org/",
    notes: "Facilities trends",
    regionScope: ["au", "us-mx-la-lng"]
  },
  {
    id: "waste360",
    label: "Waste360",
    url: "https://www.waste360.com/",
    notes: "Waste and recycling",
    regionScope: ["au", "us-mx-la-lng"]
  },
  {
    id: "security-mag",
    label: "Security Magazine",
    url: "https://www.securitymagazine.com/",
    notes: "Physical security",
    regionScope: ["au", "us-mx-la-lng"]
  }
];

export const PORTFOLIOS: PortfolioDefinition[] = [
  {
    slug: "rigs-integrated-drilling",
    label: "Rigs & Integrated Drilling",
    description: "Rig contracting, drilling campaigns, and integrated drilling services.",
    defaultIndices: energyIndices
  },
  {
    slug: "drilling-services",
    label: "Drilling Services",
    description: "Directional services, mud logging, and drilling support vendors.",
    defaultIndices: energyIndices
  },
  {
    slug: "wells-materials-octg",
    label: "Wells Materials & OCTG",
    description: "Casing, tubing, and well materials supply chain monitoring.",
    defaultIndices: steelIndices
  },
  {
    slug: "completions-intervention",
    label: "Completions & Intervention",
    description: "Completions equipment, stimulation, and intervention work.",
    defaultIndices: energyIndices
  },
  {
    slug: "pa-decommissioning",
    label: "Plug & Abandonment / Decommissioning",
    description: "Late-life asset workscopes and decom campaigns.",
    defaultIndices: energyIndices
  },
  {
    slug: "subsea-surf-offshore",
    label: "Subsea, SURF & Offshore",
    description: "Offshore construction, subsea hardware, and SURF packages.",
    defaultIndices: [...energyIndices, ...freightIndices.slice(0, 2)]
  },
  {
    slug: "projects-epc-epcm-construction",
    label: "Projects (EPC/EPCM & Construction)",
    description: "Major projects delivery, EPC/EPCM pipelines, and construction markets.",
    defaultIndices: [...energyIndices, ...freightIndices.slice(0, 2)]
  },
  {
    slug: "major-equipment-oem-ltsa",
    label: "Major Equipment OEM & LTSA",
    description: "Rotating equipment, compressors, turbines, and long-term service agreements.",
    defaultIndices: [...energyIndices.slice(0, 3), ...steelIndices.slice(0, 2)]
  },
  {
    slug: "ops-maintenance-services",
    label: "Operations & Maintenance Services",
    description: "Inspection, reliability, and maintenance services.",
    defaultIndices: [...energyIndices.slice(0, 3), ...facilityIndices.slice(0, 2)]
  },
  {
    slug: "mro-site-consumables",
    label: "MRO & Site Consumables",
    description: "Valves, consumables, and MRO supply chain visibility.",
    defaultIndices: [...steelIndices, ...facilityIndices.slice(0, 1)]
  },
  {
    slug: "logistics-marine-aviation",
    label: "Logistics, Marine & Aviation",
    description: "Marine, aviation, and freight logistics.",
    defaultIndices: freightIndices
  },
  {
    slug: "site-services-facilities",
    label: "Site Services & Facilities",
    description: "Facilities management, waste, and safety services.",
    defaultIndices: facilityIndices
  },
  {
    slug: "market-dashboard",
    label: "Oil & Gas / LNG Market Dashboard",
    description: "Cross-category market pulse and procurement implications for O&G and LNG.",
    defaultIndices: energyIndices
  },
  {
    slug: "it-telecom-cyber",
    label: "IT, Telecom & Cyber",
    description: "Cyber posture, telecom resilience, and IT sourcing.",
    defaultIndices: cyberIndices
  },
  {
    slug: "professional-services-hr",
    label: "Professional Services & HR",
    description: "HR, consulting, and professional services supply base.",
    defaultIndices: servicesIndices
  }
];

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
  const base = findPortfolio(portfolioSlug)?.defaultIndices ?? [];
  return base.filter((i) => i.regionScope.includes(region));
}
