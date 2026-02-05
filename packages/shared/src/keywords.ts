export interface PortfolioKeywordPack {
  primary: string[];
  secondary: string[];
  exclude: string[];
}

const KEYWORD_MAP: Record<string, string[]> = {
  "rigs-integrated-drilling": [
    "rig",
    "dayrate",
    "tender",
    "jack-up",
    "jackup",
    "semisub",
    "drillship",
    "MODU",
    "rig count",
    "utilization",
    "BOP",
    "well control"
  ],
  "drilling-services": [
    "directional",
    "MWD",
    "LWD",
    "mud logging",
    "drilling fluids",
    "cementing",
    "drill bit",
    "RSS",
    "BHA",
    "fishing",
    "wellsite geology"
  ],
  "wells-materials-octg": [
    "OCTG",
    "casing",
    "tubing",
    "line pipe",
    "CRA",
    "alloy",
    "premium connection",
    "wellhead",
    "tree",
    "valves",
    "flanges",
    "fittings",
    "bolting",
    "gaskets",
    "NACE"
  ],
  "completions-intervention": [
    "wireline",
    "slickline",
    "e-line",
    "coiled tubing",
    "stimulation",
    "frac",
    "acidizing",
    "perforating",
    "sand control",
    "flowback",
    "well test",
    "workover",
    "intervention"
  ],
  "pa-decommissioning": [
    "decommissioning",
    "plug and abandonment",
    "P&A",
    "abandonment",
    "removal",
    "topsides",
    "subsea removal",
    "dismantling",
    "recycling",
    "remediation"
  ],
  "subsea-surf-offshore": [
    "subsea",
    "SURF",
    "umbilical",
    "riser",
    "flowline",
    "manifold",
    "tree",
    "IMR",
    "ROV",
    "pipelay",
    "trenching",
    "tie-in",
    "offshore construction"
  ],
  "projects-epc-epcm-construction": [
    "EPC",
    "EPCM",
    "FEED",
    "construction",
    "commissioning",
    "fabrication",
    "module",
    "capex",
    "project controls",
    "brownfield",
    "greenfield"
  ],
  "major-equipment-oem-ltsa": [
    "turbine",
    "compressor",
    "pump",
    "generator",
    "LTSA",
    "OEM",
    "overhaul",
    "spares",
    "vibration",
    "condition monitoring",
    "switchgear",
    "transformer"
  ],
  "ops-maintenance-services": [
    "maintenance",
    "turnaround",
    "shutdown",
    "scaffolding",
    "rope access",
    "NDT",
    "inspection",
    "corrosion",
    "painting",
    "coatings",
    "reliability",
    "integrity"
  ],
  "mro-site-consumables": [
    "valves",
    "gaskets",
    "bolting",
    "fasteners",
    "fittings",
    "flanges",
    "PPE",
    "hoses",
    "filters",
    "bearings",
    "seals",
    "distributor",
    "catalogue"
  ],
  "logistics-marine-aviation": [
    "freight",
    "shipping",
    "marine",
    "PSV",
    "AHTS",
    "port",
    "customs",
    "3PL",
    "warehousing",
    "trucking",
    "air cargo",
    "helicopter",
    "bunker fuel"
  ],
  "site-services-facilities": [
    "catering",
    "camp",
    "accommodation",
    "facilities",
    "cleaning",
    "laundry",
    "security",
    "waste",
    "HVAC",
    "SLA"
  ],
  "it-telecom-cyber": [
    "cybersecurity",
    "ransomware",
    "vulnerability",
    "patch",
    "identity",
    "zero trust",
    "OT",
    "ICS",
    "SCADA",
    "DCS",
    "cloud",
    "SaaS",
    "telecom",
    "satcom"
  ],
  "professional-services-hr": [
    "HR",
    "recruitment",
    "staffing",
    "consulting",
    "advisory",
    "legal",
    "audit",
    "tax",
    "accounting",
    "L&D",
    "training",
    "change management"
  ]
};

const PRIMARY_OVERRIDES: Record<string, string[]> = {
  "rigs-integrated-drilling": ["rig", "dayrate", "drillship", "utilization"],
  "drilling-services": ["directional", "MWD", "cementing", "drilling fluids"],
  "wells-materials-octg": ["OCTG", "casing", "tubing", "line pipe"],
  "completions-intervention": ["wireline", "coiled tubing", "stimulation", "intervention"],
  "pa-decommissioning": ["decommissioning", "plug and abandonment", "removal", "remediation"],
  "subsea-surf-offshore": ["subsea", "SURF", "umbilical", "flowline"],
  "projects-epc-epcm-construction": ["EPC", "EPCM", "construction", "commissioning"],
  "major-equipment-oem-ltsa": ["turbine", "compressor", "LTSA", "OEM"],
  "ops-maintenance-services": ["maintenance", "turnaround", "inspection", "integrity"],
  "mro-site-consumables": ["valves", "gaskets", "bolting", "fittings"],
  "logistics-marine-aviation": ["freight", "shipping", "marine", "air cargo"],
  "site-services-facilities": ["facilities", "catering", "accommodation", "security"],
  "it-telecom-cyber": ["cybersecurity", "OT", "ICS", "telecom"],
  "professional-services-hr": ["recruitment", "staffing", "consulting", "legal"]
};

const COMMON_EXCLUDES = [
  "celebrity",
  "entertainment",
  "music",
  "movie",
  "gaming",
  "sports",
  "lottery",
  "horoscope"
];

const EXCLUDE_KEYWORDS: Record<string, string[]> = {
  "it-telecom-cyber": ["video game", "nintendo", "playstation"],
  "professional-services-hr": ["college football", "nba", "nfl"],
  "logistics-marine-aviation": ["cruise vacation", "travel deals"],
  "site-services-facilities": ["home cleaning", "residential diy"]
};

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

export function keywordPackForPortfolio(portfolioSlug: string): PortfolioKeywordPack {
  const allKeywords = KEYWORD_MAP[portfolioSlug] ?? [];
  const primary = unique(PRIMARY_OVERRIDES[portfolioSlug] ?? allKeywords.slice(0, 4));
  const secondary = allKeywords.filter((keyword) => !primary.includes(keyword));
  const exclude = unique([...(EXCLUDE_KEYWORDS[portfolioSlug] ?? []), ...COMMON_EXCLUDES]);

  return { primary, secondary, exclude };
}

/**
 * Returns prioritized keywords for a portfolio used in ranking ingestion candidates.
 * @param portfolioSlug portfolio identifier
 */
export function keywordsForPortfolio(portfolioSlug: string): string[] {
  const pack = keywordPackForPortfolio(portfolioSlug);
  return unique([...pack.primary, ...pack.secondary]);
}
