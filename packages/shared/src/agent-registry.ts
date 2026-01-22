import { AgentConfig } from "./types.js";
import { RegionSlug } from "./regions.js";

export interface AgentFramework {
  focusAreas: string[];
  keySuppliers: string[];
  marketDrivers: string[];
  procurementConsiderations: string[];
  recommendedActions?: string[];
}

export const AGENT_FRAMEWORKS: Record<string, AgentFramework> = {
  "rigs-integrated-drilling": {
    focusAreas: ["Rig utilization rates", "Day rates", "Contract awards", "Fleet movements", "Drilling permits"],
    keySuppliers: ["Transocean", "Valaris", "Noble Corp", "Seadrill", "Borr Drilling", "Patterson-UTI", "Nabors"],
    marketDrivers: ["Oil price", "Operator capex plans", "Rig supply/demand balance", "Newbuild deliveries"],
    procurementConsiderations: ["Long-term vs spot contracts", "Mobilization costs", "Crew availability", "Equipment upgrades"]
  },
  "drilling-services": {
    focusAreas: ["Service provider capacity", "Technology deployment", "Contract terms", "HSE performance"],
    keySuppliers: ["SLB", "Halliburton", "Baker Hughes", "Weatherford", "NOV", "Helmerich & Payne"],
    marketDrivers: ["Drilling activity levels", "Technology adoption", "Cost inflation", "Labor markets"],
    procurementConsiderations: ["Integrated vs discrete services", "Performance-based contracts", "Technology partnerships"]
  },
  "wells-materials-octg": {
    focusAreas: ["Steel prices", "OCTG inventory levels", "Trade policies", "Mill lead times", "Grade availability"],
    keySuppliers: ["Tenaris", "Vallourec", "U.S. Steel Tubular", "Nippon Steel", "JFE", "TMK"],
    marketDrivers: ["HRC steel prices", "Iron ore costs", "Energy costs", "Trade tariffs", "Drilling activity"],
    procurementConsiderations: ["Inventory strategies", "Specification standardization", "Supplier qualification", "Lead time hedging"]
  },
  "completions-intervention": {
    focusAreas: ["Frac fleet utilization", "Proppant pricing", "DUC inventory", "Stimulation technology"],
    keySuppliers: ["SLB", "Halliburton", "Liberty Energy", "ProFrac", "NexTier", "U.S. Silica"],
    marketDrivers: ["Well completions", "Frac spread availability", "Sand logistics", "ESG pressure (e-frac)"],
    procurementConsiderations: ["Frac fleet contracts", "Proppant logistics", "Water sourcing", "Chemical costs"]
  },
  "pa-decommissioning": {
    focusAreas: ["Regulatory timelines", "Cost estimates", "Technology innovation", "Liability transfers"],
    keySuppliers: ["Petrofac", "Wood", "Worley", "Offshore Decom", "Well-Safe Solutions", "Claxton"],
    marketDrivers: ["Regulatory enforcement", "Late-life asset transfers", "Cost reduction pressure", "Reuse/recycle mandates"],
    procurementConsiderations: ["Long-term contracts vs campaigns", "Performance bonds", "HSE requirements", "Equipment availability"]
  },
  "subsea-surf-offshore": {
    focusAreas: ["Vessel utilization", "Backlog trends", "Technology advances", "Project awards", "Installation schedules"],
    keySuppliers: ["TechnipFMC", "Subsea 7", "Saipem", "Aker Solutions", "OneSubsea (SLB)", "Oceaneering"],
    marketDrivers: ["Deepwater project sanctions", "Vessel supply", "Steel prices", "Brownfield vs greenfield mix"],
    procurementConsiderations: ["EPCI vs split contracts", "Alliance models", "Technology access", "Local content"]
  },
  "projects-epc-epcm-construction": {
    focusAreas: ["Project sanctions", "Cost inflation", "Labor availability", "Module fabrication", "Schedule performance"],
    keySuppliers: ["Bechtel", "Fluor", "KBR", "Worley", "McDermott", "Technip Energies", "Samsung Heavy", "Chiyoda"],
    marketDrivers: ["LNG FID pipeline", "Decarbonization projects", "Cost escalation", "Supply chain constraints"],
    procurementConsiderations: ["Contract structures (LSTK vs reimbursable)", "Risk allocation", "Contractor capacity", "Module strategy"]
  },
  "major-equipment-oem-ltsa": {
    focusAreas: ["Lead times", "Aftermarket pricing", "Technology transitions", "Spare parts availability", "LTSA renewals"],
    keySuppliers: ["Siemens Energy", "GE Vernova", "Baker Hughes", "Sulzer", "Atlas Copco", "Mitsubishi", "Solar Turbines"],
    marketDrivers: ["Energy transition", "Installed base growth", "Supply chain recovery", "Decarbonization tech"],
    procurementConsiderations: ["OEM vs third-party parts", "LTSA optimization", "Technology upgrades", "Obsolescence management"]
  },
  "ops-maintenance-services": {
    focusAreas: ["Contractor safety performance", "Labor rates", "Asset integrity", "Turnaround planning", "Regulatory compliance"],
    keySuppliers: ["Wood", "Worley", "Petrofac", "AKER", "Bilfinger", "Fluor", "Altrad"],
    marketDrivers: ["Asset age", "Regulatory requirements", "Labor availability", "Technology adoption (predictive maintenance)"],
    procurementConsiderations: ["Outcome-based contracts", "Labor rates", "Mobilization costs", "Integration with operations"]
  },
  "mro-site-consumables": {
    focusAreas: ["Inventory optimization", "Lead times", "Price movements", "Supplier reliability", "Standardization"],
    keySuppliers: ["Grainger", "Fastenal", "WESCO", "Applied Industrial", "Motion Industries", "Crane", "Emerson (valves)"],
    marketDrivers: ["Steel prices", "Logistics costs", "Inventory strategies", "E-commerce adoption"],
    procurementConsiderations: ["VMI programs", "Consignment", "Catalog management", "Supplier consolidation"]
  },
  "logistics-marine-aviation": {
    focusAreas: ["Freight rates", "Vessel availability", "Port congestion", "Aviation capacity", "Fuel costs"],
    keySuppliers: ["Maersk", "MSC", "CMA CGM", "CHC", "Bristow", "Swire Pacific Offshore", "Tidewater"],
    marketDrivers: ["Fuel prices", "Charter rates", "Trade flows", "Weather patterns", "Regulatory (IMO 2020)"],
    procurementConsiderations: ["Spot vs term contracts", "Fuel surcharges", "Route optimization", "Helicopter vs vessel mix"]
  },
  "site-services-facilities": {
    focusAreas: ["Camp occupancy", "Catering costs", "Waste disposal rates", "Security incidents", "HSE compliance"],
    keySuppliers: ["Sodexo", "Compass Group", "ATCO", "Target Logistics", "Vivo Energy", "Cleanaway"],
    marketDrivers: ["Project activity levels", "Labor camp requirements", "Regulatory compliance", "Cost pressure"],
    procurementConsiderations: ["Integrated FM vs discrete", "Cost per head", "Service levels", "Sustainability requirements"]
  },
  "market-dashboard": {
    focusAreas: ["Commodity prices", "Market sentiment", "Macroeconomic indicators", "Geopolitical events", "Industry outlook"],
    keySuppliers: [],
    marketDrivers: ["Oil/gas prices", "OPEC policy", "Demand growth", "Energy transition", "Geopolitics"],
    procurementConsiderations: ["Budget planning", "Forward purchasing", "Risk hedging", "Supplier negotiations"]
  },
  "it-telecom-cyber": {
    focusAreas: ["Cyber threats (OT/IT)", "Network infrastructure", "Cloud migration", "Vendor security posture", "Compliance"],
    keySuppliers: ["Microsoft", "Cisco", "Palo Alto", "CrowdStrike", "Zscaler", "ServiceNow", "SAP", "Verizon", "Telstra"],
    marketDrivers: ["Threat landscape", "Regulatory requirements", "Digital transformation", "Remote operations"],
    procurementConsiderations: ["Security assessments", "Multi-vendor integration", "Contract flexibility", "Incident response"]
  },
  "professional-services-hr": {
    focusAreas: ["Labor market trends", "Rate inflation", "Regulatory changes", "Workforce planning", "Contractor compliance"],
    keySuppliers: ["Accenture", "Deloitte", "EY", "McKinsey", "Robert Half", "Hays", "Manpower", "Baker McKenzie"],
    marketDrivers: ["Talent availability", "Wage inflation", "Remote work policies", "Regulatory changes"],
    procurementConsiderations: ["Rate benchmarking", "Statement of work clarity", "Preferred supplier panels", "IR compliance"]
  }
};

export const ACTION_RUBRIC: string[] = [
  "Tie recommendations to cost, supply risk, schedule impact, or compliance exposure.",
  "Name the supplier or stakeholder where relevant, and specify a concrete next step.",
  "Flag assumptions explicitly and state what evidence would change the recommendation."
];

export function getAgentFramework(agentId: string): AgentFramework {
  return AGENT_FRAMEWORKS[agentId] ?? AGENT_FRAMEWORKS["market-dashboard"];
}

export function buildAgentSystemPrompt(agent: AgentConfig, region: RegionSlug): string {
  const regionLabel =
    region === "au"
      ? "Australia (Perth focus, APAC region)"
      : "Americas (Houston focus, US/Mexico/LatAm LNG)";
  const context = getAgentFramework(agent.id);

  return [
    `You are an expert ${agent.label} Category Management Analyst specializing exclusively in this category.`,
    `You are a domain expert focused ONLY on ${agent.label} - analyze news through the lens of this specific category's procurement needs.`,
    "Operate as a procurement intelligence advisor: supplier strategy, negotiation levers, and sourcing risk controls.",
    `Region focus: ${regionLabel}.`,
    `Your expertise: ${context.focusAreas.join(", ")}.`,
    context.keySuppliers.length ? `Key suppliers to monitor: ${context.keySuppliers.join(", ")}.` : "Key suppliers: N/A.",
    `Market drivers affecting this category: ${context.marketDrivers.join(", ")}.`,
    `Procurement considerations: ${context.procurementConsiderations.join(", ")}.`,
    `Recommended actions rubric: ${ACTION_RUBRIC.join(" ")}`,
    "Be evidence-first: only cite claims supported by provided excerpts.",
    "Label analysis explicitly when evidence is insufficient.",
    "Be concise and actionable for category managers.",
    `IMPORTANT: Focus exclusively on ${agent.label}. Even if an article covers multiple categories, analyze it only from the ${agent.label} perspective.`
  ].join(" ");
}

export function getCategorySelectionGuidance(agent: AgentConfig): string {
  const context = getAgentFramework(agent.id);

  return `
## ARTICLE SELECTION FOR ${agent.label.toUpperCase()}

Prioritize articles that address:
${context.focusAreas.map((f) => `- ${f}`).join("\n")}

Look for mentions of key suppliers:
${context.keySuppliers.length > 0 ? context.keySuppliers.slice(0, 5).join(", ") : "N/A"}

Consider market drivers:
${context.marketDrivers.map((d) => `- ${d}`).join("\n")}

### Sourcing Relevance Test
For each article, ask: "Would a Category Manager for ${agent.label} need to know this for:
- Supplier negotiations?
- Budget planning?
- Risk management?
- Market intelligence?"

If the answer is no to all, skip the article.
`.trim();
}

export function getCategoryBriefStructure(): string {
  return `
## BRIEF STRUCTURE

Your daily intelligence brief must follow this structure:

### 1. Headline (max 12 words)
- Lead with the most significant development
- Use numbers only when explicitly present in evidence
- Format: "[Subject] [Action] [Impact/Number]"

### 2. Executive Summary (max 50 words)
- One-paragraph overview for busy executives
- Must answer: What happened? Why does it matter? What's next?

### 3. Article Briefs (3 articles, ~100 words each)
For each selected article, provide:

**briefContent** (100 words):
- Lead sentence with the key fact; use numbers only if evidence-backed
- Context about why this matters for the category
- Supplier impact showing how this affects key suppliers or supply market
- Market dynamics and what to monitor

**categoryImportance** (1-2 sentences):
- Direct, actionable insight for category managers
- Start with "This signals..." or "Monitor this because..." or "Consider..."

**keyMetrics** (2-4 data points):
- Extract numbers only when explicitly present in evidence excerpts
`.trim();
}
