import { RegionSlug } from "./regions.js";
import {
  PortfolioIndex,
  PortfolioSource,
  getPortfolioConfig,
  getPortfolioIndices,
  getPortfolioSources
} from "./portfolio-sources.js";
import { keywordsForPortfolio } from "./keywords.js";

export type PortfolioCategoryGroup = "energy" | "steel" | "freight" | "services" | "cyber" | "facility";

export interface PortfolioCatalogMeta {
  slug: string;
  label: string;
  description: string;
  categoryGroup: PortfolioCategoryGroup;
  regions: RegionSlug[];
}

export interface PortfolioCatalogEntry extends PortfolioCatalogMeta {
  queryTerms: string[];
  sources: PortfolioSource[];
  indices: PortfolioIndex[];
}

const ALL_REGIONS: RegionSlug[] = ["au", "us-mx-la-lng"];

const PORTFOLIO_META: PortfolioCatalogMeta[] = [
  {
    slug: "rigs-integrated-drilling",
    label: "Rigs & Integrated Drilling",
    description: "Rig contracting, drilling campaigns, and integrated drilling services.",
    categoryGroup: "energy",
    regions: ALL_REGIONS
  },
  {
    slug: "drilling-services",
    label: "Drilling Services",
    description: "Directional services, mud logging, and drilling support vendors.",
    categoryGroup: "energy",
    regions: ALL_REGIONS
  },
  {
    slug: "wells-materials-octg",
    label: "Wells Materials & OCTG",
    description: "Casing, tubing, and well materials supply chain monitoring.",
    categoryGroup: "steel",
    regions: ALL_REGIONS
  },
  {
    slug: "completions-intervention",
    label: "Completions & Intervention",
    description: "Completions equipment, stimulation, and intervention work.",
    categoryGroup: "energy",
    regions: ALL_REGIONS
  },
  {
    slug: "pa-decommissioning",
    label: "Plug & Abandonment / Decommissioning",
    description: "Late-life asset workscopes and decom campaigns.",
    categoryGroup: "energy",
    regions: ALL_REGIONS
  },
  {
    slug: "subsea-surf-offshore",
    label: "Subsea, SURF & Offshore",
    description: "Offshore construction, subsea hardware, and SURF packages.",
    categoryGroup: "energy",
    regions: ALL_REGIONS
  },
  {
    slug: "projects-epc-epcm-construction",
    label: "Projects (EPC/EPCM & Construction)",
    description: "Major projects delivery, EPC/EPCM pipelines, and construction markets.",
    categoryGroup: "energy",
    regions: ALL_REGIONS
  },
  {
    slug: "major-equipment-oem-ltsa",
    label: "Major Equipment OEM & LTSA",
    description: "Rotating equipment, compressors, turbines, and long-term service agreements.",
    categoryGroup: "energy",
    regions: ALL_REGIONS
  },
  {
    slug: "ops-maintenance-services",
    label: "Operations & Maintenance Services",
    description: "Inspection, reliability, and maintenance services.",
    categoryGroup: "energy",
    regions: ALL_REGIONS
  },
  {
    slug: "mro-site-consumables",
    label: "MRO & Site Consumables",
    description: "Valves, consumables, and MRO supply chain visibility.",
    categoryGroup: "steel",
    regions: ALL_REGIONS
  },
  {
    slug: "logistics-marine-aviation",
    label: "Logistics, Marine & Aviation",
    description: "Marine, aviation, and freight logistics.",
    categoryGroup: "freight",
    regions: ALL_REGIONS
  },
  {
    slug: "site-services-facilities",
    label: "Site Services & Facilities",
    description: "Facilities management, waste, and safety services.",
    categoryGroup: "facility",
    regions: ALL_REGIONS
  },
  {
    slug: "market-dashboard",
    label: "Oil & Gas / LNG Market Dashboard",
    description: "Cross-category market pulse and procurement implications for O&G and LNG.",
    categoryGroup: "energy",
    regions: ALL_REGIONS
  },
  {
    slug: "it-telecom-cyber",
    label: "IT, Telecom & Cyber",
    description: "Cyber posture, telecom resilience, and IT sourcing.",
    categoryGroup: "cyber",
    regions: ALL_REGIONS
  },
  {
    slug: "professional-services-hr",
    label: "Professional Services & HR",
    description: "HR, consulting, and professional services supply base.",
    categoryGroup: "services",
    regions: ALL_REGIONS
  }
];

function buildPortfolioCatalog(): PortfolioCatalogEntry[] {
  const catalog: PortfolioCatalogEntry[] = [];
  for (const meta of PORTFOLIO_META) {
    const config = getPortfolioConfig(meta.slug);
    if (!config) {
      throw new Error(`Portfolio catalog mismatch: missing source/index config for "${meta.slug}"`);
    }
    catalog.push({
      ...meta,
      queryTerms: keywordsForPortfolio(meta.slug),
      sources: getPortfolioSources(meta.slug),
      indices: getPortfolioIndices(meta.slug)
    });
  }
  return catalog;
}

const PORTFOLIO_CATALOG = buildPortfolioCatalog();
const PORTFOLIO_CATALOG_MAP = new Map(PORTFOLIO_CATALOG.map((entry) => [entry.slug, entry]));

export function getPortfolioCatalog(): PortfolioCatalogEntry[] {
  return PORTFOLIO_CATALOG;
}

export function getPortfolioCatalogMap(): Map<string, PortfolioCatalogEntry> {
  return PORTFOLIO_CATALOG_MAP;
}

export function findPortfolioCatalogEntry(slug: string): PortfolioCatalogEntry | undefined {
  return PORTFOLIO_CATALOG_MAP.get(slug);
}

export function portfolioCategoryGroup(slug: string): PortfolioCategoryGroup | undefined {
  return findPortfolioCatalogEntry(slug)?.categoryGroup;
}

export function portfolioRegions(slug: string): RegionSlug[] {
  return findPortfolioCatalogEntry(slug)?.regions ?? ALL_REGIONS;
}

export function portfolioQueryTerms(slug: string): string[] {
  return findPortfolioCatalogEntry(slug)?.queryTerms ?? [];
}

export function portfolioSlugs(): string[] {
  return PORTFOLIO_CATALOG.map((entry) => entry.slug);
}

