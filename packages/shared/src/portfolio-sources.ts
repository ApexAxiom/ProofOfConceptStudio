/**
 * Portfolio-specific news sources and market indices.
 * Each portfolio has dedicated sources from the verified README.
 */

export interface PortfolioSource {
  name: string;
  url: string;
  region: "apac" | "intl" | "both";
  rssUrl?: string;
}

export interface PortfolioIndex {
  symbol: string;
  name: string;
  yahooSymbol: string;
  unit: string;
  fallbackPrice: number;
  sourceUrl: string;
}

export interface PortfolioConfig {
  sources: PortfolioSource[];
  indices: PortfolioIndex[];
}

// Common energy indices
const energyIndices: PortfolioIndex[] = [
  { symbol: "WTI", name: "WTI Crude", yahooSymbol: "CL=F", unit: "/bbl", fallbackPrice: 71.23, sourceUrl: "https://finance.yahoo.com/quote/CL=F" },
  { symbol: "BRENT", name: "Brent Crude", yahooSymbol: "BZ=F", unit: "/bbl", fallbackPrice: 74.89, sourceUrl: "https://finance.yahoo.com/quote/BZ=F" },
  { symbol: "NG", name: "Natural Gas", yahooSymbol: "NG=F", unit: "/MMBtu", fallbackPrice: 3.12, sourceUrl: "https://finance.yahoo.com/quote/NG=F" },
];

// Steel indices
const steelIndices: PortfolioIndex[] = [
  { symbol: "HRC", name: "HRC Steel", yahooSymbol: "HRC1!", unit: "/ton", fallbackPrice: 740, sourceUrl: "https://www.cmegroup.com/markets/metals/ferrous/hrc-steel.html" },
  { symbol: "COPPER", name: "Copper", yahooSymbol: "HG=F", unit: "/lb", fallbackPrice: 3.85, sourceUrl: "https://finance.yahoo.com/quote/HG=F" },
  { symbol: "IRON", name: "Iron Ore", yahooSymbol: "TIO=F", unit: "/t", fallbackPrice: 108.5, sourceUrl: "https://finance.yahoo.com/quote/TIO=F" },
];

// Shipping indices
const shippingIndices: PortfolioIndex[] = [
  { symbol: "BDI", name: "Baltic Dry Index", yahooSymbol: "^BDI", unit: "pts", fallbackPrice: 1245, sourceUrl: "https://finance.yahoo.com/quote/%5EBDI" },
  { symbol: "WTI", name: "WTI (Fuel)", yahooSymbol: "CL=F", unit: "/bbl", fallbackPrice: 71.23, sourceUrl: "https://finance.yahoo.com/quote/CL=F" },
];

// LNG indices
const lngIndices: PortfolioIndex[] = [
  { symbol: "NG", name: "Henry Hub Gas", yahooSymbol: "NG=F", unit: "/MMBtu", fallbackPrice: 3.12, sourceUrl: "https://finance.yahoo.com/quote/NG=F" },
  { symbol: "LNG", name: "Cheniere (LNG)", yahooSymbol: "LNG", unit: "", fallbackPrice: 185, sourceUrl: "https://finance.yahoo.com/quote/LNG" },
  { symbol: "BRENT", name: "Brent Crude", yahooSymbol: "BZ=F", unit: "/bbl", fallbackPrice: 74.89, sourceUrl: "https://finance.yahoo.com/quote/BZ=F" },
];

export const PORTFOLIO_CONFIGS: Record<string, PortfolioConfig> = {
  // Rigs & Integrated Drilling
  "rigs-integrated-drilling": {
    sources: [
      { name: "Rigzone", url: "https://www.rigzone.com/", region: "both", rssUrl: "https://www.rigzone.com/news/rss/rigzone_latest.aspx" },
      { name: "World Oil", url: "https://www.worldoil.com/", region: "intl" },
      { name: "Oil & Gas Journal", url: "https://www.ogj.com/", region: "intl" },
      { name: "Offshore Magazine", url: "https://www.offshore-mag.com/", region: "intl" },
      { name: "Energy Voice", url: "https://www.energyvoice.com/", region: "intl" },
      { name: "Drilling Contractor (IADC)", url: "https://drillingcontractor.org/", region: "both" },
      { name: "Energy News Bulletin", url: "https://www.energynewsbulletin.net/", region: "apac" },
      { name: "Energy Today (AU)", url: "https://www.energytodaymag.com.au/", region: "apac" },
      { name: "NOPSEMA", url: "https://www.nopsema.gov.au/", region: "apac" },
      { name: "NOPTA", url: "https://www.nopta.gov.au/", region: "apac" },
      { name: "Baker Hughes Rig Count", url: "https://bakerhughesrigcount.gcs-web.com/rig-count-overview", region: "intl" },
      { name: "EIA Drilling Report", url: "https://www.eia.gov/petroleum/drilling/", region: "intl" },
    ],
    indices: [
      ...energyIndices,
      { symbol: "RIG", name: "Transocean", yahooSymbol: "RIG", unit: "", fallbackPrice: 4.50, sourceUrl: "https://finance.yahoo.com/quote/RIG" },
      { symbol: "VAL", name: "Valaris", yahooSymbol: "VAL", unit: "", fallbackPrice: 52, sourceUrl: "https://finance.yahoo.com/quote/VAL" },
    ],
  },

  // Drilling Services
  "drilling-services": {
    sources: [
      { name: "Rigzone", url: "https://www.rigzone.com/", region: "both" },
      { name: "World Oil", url: "https://www.worldoil.com/", region: "intl" },
      { name: "Journal of Petroleum Technology", url: "https://jpt.spe.org/", region: "both" },
      { name: "Halliburton Newsroom", url: "https://www.halliburton.com/en/newsroom.html", region: "both" },
      { name: "SLB Newsroom", url: "https://www.slb.com/newsroom", region: "both" },
      { name: "Baker Hughes News", url: "https://www.bakerhughes.com/company/newsroom", region: "both" },
      { name: "Energy News Bulletin", url: "https://www.energynewsbulletin.net/", region: "apac" },
      { name: "Energy Today (AU)", url: "https://www.energytodaymag.com.au/", region: "apac" },
    ],
    indices: [
      ...energyIndices,
      { symbol: "SLB", name: "Schlumberger", yahooSymbol: "SLB", unit: "", fallbackPrice: 48, sourceUrl: "https://finance.yahoo.com/quote/SLB" },
      { symbol: "HAL", name: "Halliburton", yahooSymbol: "HAL", unit: "", fallbackPrice: 35, sourceUrl: "https://finance.yahoo.com/quote/HAL" },
      { symbol: "BKR", name: "Baker Hughes", yahooSymbol: "BKR", unit: "", fallbackPrice: 32, sourceUrl: "https://finance.yahoo.com/quote/BKR" },
    ],
  },

  // Wells Materials & OCTG
  "wells-materials-octg": {
    sources: [
      { name: "SteelBenchmarker", url: "https://steelbenchmarker.com/", region: "both" },
      { name: "SteelGuru", url: "https://www.steelguru.com/", region: "both" },
      { name: "S&P Global Metals", url: "https://www.spglobal.com/commodityinsights/en/commodities/metals", region: "both" },
      { name: "Mysteel Global", url: "https://www.mysteel.net/", region: "apac" },
      { name: "CME HRC Steel", url: "https://www.cmegroup.com/markets/metals/ferrous/hrc-steel.html", region: "intl" },
      { name: "LME Ferrous", url: "https://www.lme.com/en/metals/ferrous", region: "both" },
      { name: "Tenaris", url: "https://www.tenaris.com/", region: "both" },
      { name: "Vallourec", url: "https://www.vallourec.com/", region: "both" },
      { name: "Australian Steel Institute", url: "https://www.steel.org.au/news-and-events/news/", region: "apac" },
    ],
    indices: [
      ...steelIndices,
      { symbol: "TS", name: "Tenaris", yahooSymbol: "TS", unit: "", fallbackPrice: 32, sourceUrl: "https://finance.yahoo.com/quote/TS" },
    ],
  },

  // Completions & Intervention
  "completions-intervention": {
    sources: [
      { name: "World Oil - Completions", url: "https://www.worldoil.com/topics/completions/", region: "intl" },
      { name: "Journal of Petroleum Technology", url: "https://jpt.spe.org/", region: "both" },
      { name: "Rigzone", url: "https://www.rigzone.com/", region: "both" },
      { name: "Hart Energy", url: "https://www.hartenergy.com/", region: "intl" },
      { name: "SLB Newsroom", url: "https://www.slb.com/newsroom", region: "both" },
      { name: "Halliburton Newsroom", url: "https://www.halliburton.com/en/newsroom.html", region: "both" },
      { name: "Energy News Bulletin", url: "https://www.energynewsbulletin.net/", region: "apac" },
      { name: "EIA - DUC Report", url: "https://www.eia.gov/petroleum/drilling/", region: "intl" },
    ],
    indices: [
      ...energyIndices,
      { symbol: "SLB", name: "Schlumberger", yahooSymbol: "SLB", unit: "", fallbackPrice: 48, sourceUrl: "https://finance.yahoo.com/quote/SLB" },
      { symbol: "HAL", name: "Halliburton", yahooSymbol: "HAL", unit: "", fallbackPrice: 35, sourceUrl: "https://finance.yahoo.com/quote/HAL" },
    ],
  },

  // Plug & Abandonment / Decommissioning
  "pa-decommissioning": {
    sources: [
      { name: "CODA Australia", url: "https://www.decommissioning.org.au/", region: "apac" },
      { name: "NOPSEMA Decommissioning", url: "https://www.nopsema.gov.au/blogs/categories/decommissioning", region: "apac" },
      { name: "Decom Mission", url: "https://decommission.net/", region: "intl" },
      { name: "OEUK Decommissioning", url: "https://oeuk.org.uk/category/offshore-energies-news/decommissioning-news/", region: "intl" },
      { name: "Offshore Engineer", url: "https://www.oedigital.com/", region: "both" },
      { name: "BSEE Newsroom", url: "https://www.bsee.gov/newsroom", region: "intl" },
      { name: "Energy News Bulletin", url: "https://www.energynewsbulletin.net/", region: "apac" },
    ],
    indices: [
      ...energyIndices,
      { symbol: "BDI", name: "Baltic Dry", yahooSymbol: "^BDI", unit: "pts", fallbackPrice: 1245, sourceUrl: "https://finance.yahoo.com/quote/%5EBDI" },
    ],
  },

  // Subsea, SURF & Offshore
  "subsea-surf-offshore": {
    sources: [
      { name: "Offshore Magazine", url: "https://www.offshore-mag.com/", region: "intl" },
      { name: "Offshore Engineer", url: "https://www.oedigital.com/", region: "both" },
      { name: "Subsea World News", url: "https://www.offshore-energy.biz/subsea/", region: "both", rssUrl: "https://www.offshore-energy.biz/feed/" },
      { name: "Offshore Technology", url: "https://www.offshore-technology.com/", region: "both" },
      { name: "Maritime Executive", url: "https://www.maritime-executive.com/", region: "both" },
      { name: "Subsea 7 News", url: "https://www.subsea7.com/en/media/news.html", region: "both" },
      { name: "TechnipFMC", url: "https://www.technipfmc.com/", region: "both" },
      { name: "Subsea Energy Australia", url: "https://subseaenergy.org.au/", region: "apac" },
    ],
    indices: [
      ...energyIndices,
      ...shippingIndices,
      { symbol: "FTI", name: "TechnipFMC", yahooSymbol: "FTI", unit: "", fallbackPrice: 22, sourceUrl: "https://finance.yahoo.com/quote/FTI" },
    ],
  },

  // Projects (EPC/EPCM & Construction)
  "projects-epc-epcm-construction": {
    sources: [
      { name: "Engineering News-Record", url: "https://www.enr.com/", region: "intl" },
      { name: "LNG Industry", url: "https://www.lngindustry.com/", region: "both", rssUrl: "https://www.lngindustry.com/rss/" },
      { name: "Hydrocarbon Engineering", url: "https://www.hydrocarbonengineering.com/", region: "both" },
      { name: "World Oil", url: "https://www.worldoil.com/", region: "intl" },
      { name: "Global Construction Review", url: "https://www.globalconstructionreview.com/", region: "both" },
      { name: "Worley", url: "https://www.worley.com/", region: "both" },
      { name: "Bechtel", url: "https://www.bechtel.com/", region: "intl" },
      { name: "KBR", url: "https://www.kbr.com/", region: "intl" },
      { name: "Energy News Bulletin", url: "https://www.energynewsbulletin.net/", region: "apac" },
      { name: "Infrastructure Australia", url: "https://www.infrastructureaustralia.gov.au/listing/news", region: "apac" },
    ],
    indices: [
      ...lngIndices,
      { symbol: "FLR", name: "Fluor Corp", yahooSymbol: "FLR", unit: "", fallbackPrice: 42, sourceUrl: "https://finance.yahoo.com/quote/FLR" },
      { symbol: "KBR", name: "KBR Inc", yahooSymbol: "KBR", unit: "", fallbackPrice: 58, sourceUrl: "https://finance.yahoo.com/quote/KBR" },
    ],
  },

  // Major Equipment OEM & LTSA
  "major-equipment-oem-ltsa": {
    sources: [
      { name: "Turbomachinery Magazine", url: "https://www.turbomachinerymag.com/", region: "both" },
      { name: "CompressorTech2", url: "https://www.compressortech2.com/", region: "both" },
      { name: "Power Engineering", url: "https://www.power-eng.com/", region: "intl" },
      { name: "Siemens Energy News", url: "https://www.siemens-energy.com/global/en/news.html", region: "both" },
      { name: "GE Vernova News", url: "https://www.gevernova.com/news", region: "both" },
      { name: "Baker Hughes News", url: "https://www.bakerhughes.com/company/newsroom", region: "both" },
      { name: "Sulzer News", url: "https://www.sulzer.com/en/shared/news", region: "both" },
      { name: "Process Online (AU)", url: "https://www.processonline.com.au/", region: "apac" },
    ],
    indices: [
      ...energyIndices,
      { symbol: "BKR", name: "Baker Hughes", yahooSymbol: "BKR", unit: "", fallbackPrice: 32, sourceUrl: "https://finance.yahoo.com/quote/BKR" },
      { symbol: "GEV", name: "GE Vernova", yahooSymbol: "GEV", unit: "", fallbackPrice: 175, sourceUrl: "https://finance.yahoo.com/quote/GEV" },
    ],
  },

  // Operations & Maintenance Services
  "ops-maintenance-services": {
    sources: [
      { name: "Reliabilityweb", url: "https://reliabilityweb.com/", region: "both" },
      { name: "Maintenance World", url: "https://maintenance.org/", region: "both" },
      { name: "EHS Today", url: "https://www.ehstoday.com/", region: "intl" },
      { name: "Plant Engineering", url: "https://www.plantengineering.com/", region: "both" },
      { name: "Inspectioneering", url: "https://inspectioneering.com/", region: "intl" },
      { name: "NOPSEMA", url: "https://www.nopsema.gov.au/", region: "apac" },
      { name: "Safe Work Australia", url: "https://www.safeworkaustralia.gov.au/media-centre/news", region: "apac" },
      { name: "OSHA News", url: "https://www.osha.gov/news/newsreleases", region: "intl" },
    ],
    indices: [
      ...energyIndices,
      { symbol: "JCI", name: "Johnson Controls", yahooSymbol: "JCI", unit: "", fallbackPrice: 65, sourceUrl: "https://finance.yahoo.com/quote/JCI" },
    ],
  },

  // MRO & Site Consumables
  "mro-site-consumables": {
    sources: [
      { name: "Valve World", url: "https://valve-world.net/", region: "both" },
      { name: "Industrial Distribution", url: "https://www.inddist.com/", region: "intl" },
      { name: "Supply Chain Dive", url: "https://www.supplychaindive.com/", region: "both" },
      { name: "Pumps & Systems", url: "https://www.pumpsandsystems.com/", region: "both" },
      { name: "Fluid Power Journal", url: "https://fluidpowerjournal.com/", region: "intl" },
      { name: "Manufacturers' Monthly (AU)", url: "https://www.manmonthly.com.au/", region: "apac" },
      { name: "Process Online (AU)", url: "https://www.processonline.com.au/", region: "apac" },
    ],
    indices: [
      ...steelIndices,
      { symbol: "GWW", name: "Grainger", yahooSymbol: "GWW", unit: "", fallbackPrice: 920, sourceUrl: "https://finance.yahoo.com/quote/GWW" },
      { symbol: "FAST", name: "Fastenal", yahooSymbol: "FAST", unit: "", fallbackPrice: 68, sourceUrl: "https://finance.yahoo.com/quote/FAST" },
    ],
  },

  // Logistics, Marine & Aviation
  "logistics-marine-aviation": {
    sources: [
      { name: "Maritime Executive", url: "https://www.maritime-executive.com/", region: "both" },
      { name: "FreightWaves", url: "https://www.freightwaves.com/", region: "both" },
      { name: "Lloyd's List", url: "https://www.lloydslist.com/", region: "intl" },
      { name: "Baltic Exchange", url: "https://www.balticexchange.com/en/index.html", region: "both" },
      { name: "Air Cargo News", url: "https://www.aircargonews.net/", region: "both" },
      { name: "Vertical Magazine", url: "https://verticalmag.com/", region: "both" },
      { name: "Daily Cargo News (AU)", url: "https://www.thedcn.com.au/", region: "apac" },
      { name: "Shipping Australia", url: "https://shippingaustralia.com.au/", region: "apac" },
      { name: "Australian Aviation", url: "https://australianaviation.com.au/", region: "apac" },
    ],
    indices: [
      ...shippingIndices,
      { symbol: "FDX", name: "FedEx", yahooSymbol: "FDX", unit: "", fallbackPrice: 285, sourceUrl: "https://finance.yahoo.com/quote/FDX" },
      { symbol: "UPS", name: "UPS", yahooSymbol: "UPS", unit: "", fallbackPrice: 142, sourceUrl: "https://finance.yahoo.com/quote/UPS" },
      { symbol: "MAERSK", name: "Maersk", yahooSymbol: "AMKBY", unit: "", fallbackPrice: 9.5, sourceUrl: "https://finance.yahoo.com/quote/AMKBY" },
    ],
  },

  // Site Services & Facilities
  "site-services-facilities": {
    sources: [
      { name: "IFMA", url: "https://www.ifma.org/", region: "both" },
      { name: "Facility Executive", url: "https://facilityexecutive.com/", region: "intl" },
      { name: "Waste360", url: "https://www.waste360.com/", region: "intl" },
      { name: "Security Magazine", url: "https://www.securitymagazine.com/", region: "intl" },
      { name: "EHS Today", url: "https://www.ehstoday.com/", region: "intl" },
      { name: "OSHA News", url: "https://www.osha.gov/news/newsreleases", region: "intl" },
      { name: "FM Magazine (AU)", url: "https://www.fmmagazine.com.au/", region: "apac" },
      { name: "Waste Management Review (AU)", url: "https://wastemanagementreview.com.au/", region: "apac" },
      { name: "Safe Work Australia", url: "https://www.safeworkaustralia.gov.au/media-centre/news", region: "apac" },
    ],
    indices: [
      { symbol: "WM", name: "Waste Management", yahooSymbol: "WM", unit: "", fallbackPrice: 185, sourceUrl: "https://finance.yahoo.com/quote/WM" },
      { symbol: "RSG", name: "Republic Services", yahooSymbol: "RSG", unit: "", fallbackPrice: 175, sourceUrl: "https://finance.yahoo.com/quote/RSG" },
      { symbol: "NG", name: "Natural Gas", yahooSymbol: "NG=F", unit: "/MMBtu", fallbackPrice: 3.12, sourceUrl: "https://finance.yahoo.com/quote/NG=F" },
    ],
  },

  // Market Dashboard
  "market-dashboard": {
    sources: [
      { name: "Reuters Energy", url: "https://www.reuters.com/business/energy/", region: "both" },
      { name: "MarketWatch Energy", url: "https://www.marketwatch.com/investing/futures/crude-oil", region: "both" },
      { name: "LNG Industry", url: "https://www.lngindustry.com/", region: "both", rssUrl: "https://www.lngindustry.com/rss/" },
      { name: "S&P Global Energy", url: "https://www.spglobal.com/commodityinsights/en/commodities/energy", region: "both" },
      { name: "EIA Today in Energy", url: "https://www.eia.gov/todayinenergy/", region: "intl" },
      { name: "AEMO Gas Bulletin", url: "https://aemo.com.au/en/energy-systems/gas/gas-bulletin-board-gbb", region: "apac" },
    ],
    indices: [
      ...energyIndices,
      ...lngIndices,
      ...shippingIndices,
    ],
  },

  // IT, Telecom & Cyber
  "it-telecom-cyber": {
    sources: [
      { name: "Dark Reading", url: "https://www.darkreading.com/", region: "both" },
      { name: "CyberScoop", url: "https://www.cyberscoop.com/", region: "intl" },
      { name: "BleepingComputer", url: "https://www.bleepingcomputer.com/", region: "both" },
      { name: "The Hacker News", url: "https://thehackernews.com/", region: "both" },
      { name: "CISA Advisories", url: "https://www.cisa.gov/news-events/cybersecurity-advisories", region: "intl" },
      { name: "Industrial Cyber", url: "https://industrialcyber.co/", region: "both" },
      { name: "iTnews (AU)", url: "https://www.itnews.com.au/", region: "apac" },
      { name: "Cyber Daily (AU)", url: "https://cyberdaily.au/", region: "apac" },
      { name: "ACSC (AU)", url: "https://www.cyber.gov.au/", region: "apac" },
    ],
    indices: [
      { symbol: "PANW", name: "Palo Alto", yahooSymbol: "PANW", unit: "", fallbackPrice: 320, sourceUrl: "https://finance.yahoo.com/quote/PANW" },
      { symbol: "CRWD", name: "CrowdStrike", yahooSymbol: "CRWD", unit: "", fallbackPrice: 285, sourceUrl: "https://finance.yahoo.com/quote/CRWD" },
      { symbol: "ZS", name: "Zscaler", yahooSymbol: "ZS", unit: "", fallbackPrice: 195, sourceUrl: "https://finance.yahoo.com/quote/ZS" },
      { symbol: "FTNT", name: "Fortinet", yahooSymbol: "FTNT", unit: "", fallbackPrice: 72, sourceUrl: "https://finance.yahoo.com/quote/FTNT" },
    ],
  },

  // Professional Services & HR
  "professional-services-hr": {
    sources: [
      { name: "HR Dive", url: "https://www.hrdive.com/", region: "intl" },
      { name: "SHRM News", url: "https://www.shrm.org/topics-tools/news", region: "intl" },
      { name: "Consulting.us", url: "https://www.consulting.us/news", region: "intl" },
      { name: "Accounting Today", url: "https://www.accountingtoday.com/", region: "intl" },
      { name: "HRM Online (AU)", url: "https://www.hrmonline.com.au/", region: "apac" },
      { name: "Fair Work Ombudsman (AU)", url: "https://www.fairwork.gov.au/newsroom/news", region: "apac" },
      { name: "Consultancy.com.au", url: "https://www.consultancy.com.au/news", region: "apac" },
      { name: "Lawyers Weekly (AU)", url: "https://www.lawyersweekly.com.au/", region: "apac" },
    ],
    indices: [
      { symbol: "ACN", name: "Accenture", yahooSymbol: "ACN", unit: "", fallbackPrice: 345, sourceUrl: "https://finance.yahoo.com/quote/ACN" },
      { symbol: "ADP", name: "ADP", yahooSymbol: "ADP", unit: "", fallbackPrice: 245, sourceUrl: "https://finance.yahoo.com/quote/ADP" },
      { symbol: "RHI", name: "Robert Half", yahooSymbol: "RHI", unit: "", fallbackPrice: 72, sourceUrl: "https://finance.yahoo.com/quote/RHI" },
      { symbol: "SPX", name: "S&P 500", yahooSymbol: "^GSPC", unit: "pts", fallbackPrice: 5125, sourceUrl: "https://finance.yahoo.com/quote/%5EGSPC" },
    ],
  },
};

export function getPortfolioConfig(portfolioSlug: string): PortfolioConfig | undefined {
  return PORTFOLIO_CONFIGS[portfolioSlug];
}

export function getPortfolioSources(portfolioSlug: string, region?: "apac" | "intl"): PortfolioSource[] {
  const config = PORTFOLIO_CONFIGS[portfolioSlug];
  if (!config) return [];
  
  if (!region) return config.sources;
  
  return config.sources.filter(s => s.region === region || s.region === "both");
}

export function getPortfolioIndices(portfolioSlug: string): PortfolioIndex[] {
  return PORTFOLIO_CONFIGS[portfolioSlug]?.indices ?? [];
}

