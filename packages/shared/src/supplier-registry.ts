import { RegionSlug } from "./regions.js";
import { AGENT_FRAMEWORKS } from "./agent-registry.js";

/**
 * Region-aware supplier/operator registry used for entity matching during
 * ingestion ranking and for supplier-arc tracking in briefs.
 *
 * Builds on AGENT_FRAMEWORKS.keySuppliers (global names) and layers in
 * region-specific suppliers plus demand-side operators. Aliases cover common
 * alternate names so "Schlumberger" and "SLB" count as the same entity.
 */

export interface CategoryEntity {
  /** Canonical display name. */
  name: string;
  /** Alternate spellings/names matched in text (canonical name is always matched). */
  aliases?: string[];
  kind: "supplier" | "operator";
  /** Restrict relevance to specific regions; omitted = relevant everywhere. */
  regions?: RegionSlug[];
}

function supplier(name: string, aliases?: string[], regions?: RegionSlug[]): CategoryEntity {
  return { name, aliases, kind: "supplier", regions };
}

function operator(name: string, aliases?: string[], regions?: RegionSlug[]): CategoryEntity {
  return { name, aliases, kind: "operator", regions };
}

const SUPPLIER_ALIASES: Record<string, string[]> = {
  SLB: ["Schlumberger", "OneSubsea"],
  "Baker Hughes": ["BHGE"],
  "Noble Corp": ["Noble Corporation", "Noble Drilling"],
  "GE Vernova": ["General Electric Vernova"],
  "U.S. Steel Tubular": ["US Steel Tubular", "U. S. Steel"],
  "Helmerich & Payne": ["H&P"],
  "Technip Energies": ["TechnipEnergies"],
  TechnipFMC: ["Technip FMC"],
  "Wood": ["Wood Group", "John Wood Group"],
  "Compass Group": ["ESS Support Services", "Eurest"],
  "MAN Energy Solutions": ["MAN ES"],
  NOV: ["National Oilwell Varco"],
  "Siemens Energy": ["Siemens-Energy"],
  "Mitsubishi": ["Mitsubishi Heavy Industries", "MHI"],
  CHC: ["CHC Helicopter"],
  Bristow: ["Bristow Group"]
};

/** Demand-side operators whose activity moves every category in a region. */
const OPERATORS: CategoryEntity[] = [
  operator("Woodside", ["Woodside Energy"], ["au"]),
  operator("Santos", undefined, ["au"]),
  operator("Inpex", ["INPEX"], ["au"]),
  operator("Chevron", ["Chevron Australia"]),
  operator("Shell", ["Shell Australia", "Shell plc"]),
  operator("ExxonMobil", ["Exxon Mobil", "Esso"]),
  operator("BP", ["bp plc"]),
  operator("TotalEnergies", ["Total Energies"]),
  operator("ConocoPhillips", undefined),
  operator("Eni", undefined),
  operator("Pemex", ["Petróleos Mexicanos", "Petroleos Mexicanos"], ["us-mx-la-lng"]),
  operator("Cheniere", ["Cheniere Energy"], ["us-mx-la-lng"]),
  operator("Venture Global", ["Venture Global LNG"], ["us-mx-la-lng"]),
  operator("Sempra", ["Sempra Infrastructure"], ["us-mx-la-lng"]),
  operator("NextDecade", ["Next Decade"], ["us-mx-la-lng"]),
  operator("Kosmos Energy", undefined, ["us-mx-la-lng"])
];

/** Region-specific suppliers layered on top of AGENT_FRAMEWORKS.keySuppliers. */
const REGIONAL_SUPPLIERS: Record<string, CategoryEntity[]> = {
  "rigs-integrated-drilling": [
    supplier("Diamond Offshore"),
    supplier("Vantage Drilling"),
    supplier("Shelf Drilling"),
    supplier("Velesto", undefined, ["au"])
  ],
  "drilling-services": [supplier("Expro"), supplier("ChampionX")],
  "wells-materials-octg": [
    supplier("Marubeni-Itochu", ["MISI", "Marubeni Itochu"]),
    supplier("Hunting", ["Hunting PLC"]),
    supplier("BlueScope", undefined, ["au"])
  ],
  "completions-intervention": [supplier("Altus Intervention"), supplier("Archer")],
  "pa-decommissioning": [
    supplier("Heerema"),
    supplier("Allseas"),
    supplier("DOF", ["DOF Subsea"]),
    supplier("Sea Swift", undefined, ["au"])
  ],
  "subsea-surf-offshore": [
    supplier("McDermott"),
    supplier("Fugro"),
    supplier("DeepOcean"),
    supplier("MMA Offshore", undefined, ["au"])
  ],
  "projects-epc-epcm-construction": [
    supplier("Clough", undefined, ["au"]),
    supplier("Monadelphous", undefined, ["au"]),
    supplier("CIMIC", ["UGL"], ["au"]),
    supplier("Samsung Heavy", ["Samsung Heavy Industries", "SHI"]),
    supplier("Hyundai Heavy", ["HD Hyundai", "Hyundai Heavy Industries"])
  ],
  "major-equipment-oem-ltsa": [
    supplier("Solar Turbines"),
    supplier("Elliott Group"),
    supplier("Howden"),
    supplier("Aggreko")
  ],
  "ops-maintenance-services": [
    supplier("Monadelphous", undefined, ["au"]),
    supplier("Vertech", undefined, ["au"]),
    supplier("Cape", ["Altrad Cape"]),
    supplier("Stork"),
    supplier("UGL", undefined, ["au"])
  ],
  "mro-site-consumables": [
    supplier("Blackwoods", undefined, ["au"]),
    supplier("RS Components", ["RS Group"]),
    supplier("Würth", ["Wurth"])
  ],
  "logistics-marine-aviation": [
    supplier("Tidewater"),
    supplier("Bhagwan Marine", undefined, ["au"]),
    supplier("MMA Offshore", undefined, ["au"]),
    supplier("Qantas", ["QantasLink"], ["au"]),
    supplier("Toll Group", ["Toll Holdings"], ["au"]),
    supplier("PHI Aviation", ["PHI Helicopters"], ["us-mx-la-lng"]),
    supplier("Edison Chouest", ["Chouest"], ["us-mx-la-lng"]),
    supplier("Hornbeck", ["Hornbeck Offshore"], ["us-mx-la-lng"])
  ],
  "site-services-facilities": [
    supplier("Civeo", undefined),
    supplier("Veolia"),
    supplier("Cleanaway", undefined, ["au"]),
    supplier("ISS", ["ISS Facility Services"])
  ],
  "it-telecom-cyber": [
    supplier("Telstra", undefined, ["au"]),
    supplier("Optus", undefined, ["au"]),
    supplier("Speedcast"),
    supplier("Inmarsat", ["Viasat"]),
    supplier("Starlink", ["SpaceX"]),
    supplier("Fortinet"),
    supplier("AWS", ["Amazon Web Services"])
  ],
  "professional-services-hr": [
    supplier("KPMG"),
    supplier("PwC", ["PricewaterhouseCoopers"]),
    supplier("Airswift"),
    supplier("Brunel"),
    supplier("NES Fircroft", ["NES Global Talent"])
  ]
};

const registryCache = new Map<string, CategoryEntity[]>();

/**
 * Returns the entities (suppliers + operators) relevant to a portfolio in a
 * region. Suppliers come from AGENT_FRAMEWORKS plus regional additions.
 */
export function entitiesForPortfolio(portfolioSlug: string, region: RegionSlug): CategoryEntity[] {
  const cacheKey = `${portfolioSlug}:${region}`;
  const cached = registryCache.get(cacheKey);
  if (cached) return cached;

  const frameworkSuppliers = (AGENT_FRAMEWORKS[portfolioSlug]?.keySuppliers ?? []).map((name) =>
    supplier(name, SUPPLIER_ALIASES[name])
  );
  const regional = REGIONAL_SUPPLIERS[portfolioSlug] ?? [];

  const seen = new Set<string>();
  const merged: CategoryEntity[] = [];
  for (const entity of [...frameworkSuppliers, ...regional, ...OPERATORS]) {
    if (entity.regions && !entity.regions.includes(region)) continue;
    const key = entity.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(entity);
  }

  registryCache.set(cacheKey, merged);
  return merged;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const matcherCache = new Map<string, { entity: CategoryEntity; pattern: RegExp }[]>();

function matchersFor(portfolioSlug: string, region: RegionSlug) {
  const cacheKey = `${portfolioSlug}:${region}`;
  const cached = matcherCache.get(cacheKey);
  if (cached) return cached;
  const matchers = entitiesForPortfolio(portfolioSlug, region).map((entity) => {
    const names = [entity.name, ...(entity.aliases ?? [])].map(escapeRegExp);
    return { entity, pattern: new RegExp(`\\b(?:${names.join("|")})\\b`, "i") };
  });
  matcherCache.set(cacheKey, matchers);
  return matchers;
}

export interface EntityMatch {
  name: string;
  kind: "supplier" | "operator";
}

/**
 * Finds registry entities mentioned in the given text. Returns canonical
 * names so alias hits consolidate onto one entity.
 */
export function matchEntities(text: string, portfolioSlug: string, region: RegionSlug): EntityMatch[] {
  const haystack = (text ?? "").slice(0, 6000);
  if (!haystack) return [];
  const matches: EntityMatch[] = [];
  for (const { entity, pattern } of matchersFor(portfolioSlug, region)) {
    if (pattern.test(haystack)) {
      matches.push({ name: entity.name, kind: entity.kind });
    }
  }
  return matches;
}
