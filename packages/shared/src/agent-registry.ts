import { AgentConfig } from "./types.js";
import { RegionSlug } from "./regions.js";

export interface AgentFramework {
  focusAreas: string[];
  keySuppliers: string[];
  marketDrivers: string[];
  procurementConsiderations: string[];
  recommendedActions?: string[];
  dailyCMLens: {
    costDrivers: string[];
    capacityDrivers: string[];
    supplierBehavior: string[];
    contractingImplications: string[];
    complianceTriggers: string[];
  };
}

export const AGENT_FRAMEWORKS: Record<string, AgentFramework> = {
  "rigs-integrated-drilling": {
    focusAreas: ["Rig utilization rates", "Day rates", "Contract awards", "Fleet movements", "Drilling permits", "Contract rollover pipeline"],
    keySuppliers: ["Transocean", "Valaris", "Noble Corp", "Seadrill", "Borr Drilling", "Patterson-UTI", "Nabors"],
    marketDrivers: ["Oil price", "Operator capex plans", "Rig supply/demand balance", "Newbuild deliveries", "Tender backlog"],
    procurementConsiderations: ["Long-term vs spot contracts", "Mobilization costs", "Crew availability", "Equipment upgrades", "Termination fee exposure"],
    dailyCMLens: {
      costDrivers: ["Day-rate moves", "Mobilization/demob pricing", "Crew and fuel surcharges"],
      capacityDrivers: ["Rig utilization and availability", "Fleet reactivations or retirements", "Newbuild delivery timing"],
      supplierBehavior: ["Tender participation", "Contract extension appetite", "Demand for term length"],
      contractingImplications: ["Options/extension clauses", "Performance and downtime LDs", "Rate reset triggers"],
      complianceTriggers: ["Drilling permit changes", "HSE incident alerts", "Regulatory approvals for rigs"]
    }
  },
  "drilling-services": {
    focusAreas: ["Service provider capacity", "Technology deployment", "Contract terms", "HSE performance", "Pricing escalators"],
    keySuppliers: ["SLB", "Halliburton", "Baker Hughes", "Weatherford", "NOV", "Helmerich & Payne"],
    marketDrivers: ["Drilling activity levels", "Technology adoption", "Cost inflation", "Labor markets", "Service intensity shifts"],
    procurementConsiderations: ["Integrated vs discrete services", "Performance-based contracts", "Technology partnerships", "Scope bundling tradeoffs"],
    dailyCMLens: {
      costDrivers: ["Service rate sheets", "Consumables pricing (mud, bits)", "Labor premiums"],
      capacityDrivers: ["Frac/spread availability", "Tool inventory", "Crew coverage by basin"],
      supplierBehavior: ["Bundling offers", "Tech upsell pressure", "Capacity allocation to key operators"],
      contractingImplications: ["KPI-linked incentives", "Tool replacement terms", "Price escalation clauses"],
      complianceTriggers: ["HSE incidents", "Regulatory drilling advisories", "Local content requirements"]
    }
  },
  "wells-materials-octg": {
    focusAreas: ["Steel prices", "OCTG inventory levels", "Trade policies", "Mill lead times", "Grade availability", "Lead time volatility"],
    keySuppliers: ["Tenaris", "Vallourec", "U.S. Steel Tubular", "Nippon Steel", "JFE", "TMK"],
    marketDrivers: ["HRC steel prices", "Iron ore costs", "Energy costs", "Trade tariffs", "Drilling activity", "Import freight rates"],
    procurementConsiderations: ["Inventory strategies", "Specification standardization", "Supplier qualification", "Lead time hedging", "Mill allocation risk"],
    dailyCMLens: {
      costDrivers: ["HRC steel and alloy surcharges", "Mill energy costs", "FX impacts on imports"],
      capacityDrivers: ["Mill lead times", "Allocation quotas", "Port congestion"],
      supplierBehavior: ["Quota tightness", "Advance payment asks", "Substitution proposals"],
      contractingImplications: ["Indexation to HRC", "Minimum volume commits", "Quality/grade substitution clauses"],
      complianceTriggers: ["Trade tariffs/quotas", "API/ISO spec updates", "Customs enforcement changes"]
    }
  },
  "completions-intervention": {
    focusAreas: ["Frac fleet utilization", "Proppant pricing", "DUC inventory", "Stimulation technology", "E-frac adoption"],
    keySuppliers: ["SLB", "Halliburton", "Liberty Energy", "ProFrac", "NexTier", "U.S. Silica"],
    marketDrivers: ["Well completions", "Frac spread availability", "Sand logistics", "ESG pressure (e-frac)", "Diesel/power costs"],
    procurementConsiderations: ["Frac fleet contracts", "Proppant logistics", "Water sourcing", "Chemical costs", "Power/fuel pass-throughs"],
    dailyCMLens: {
      costDrivers: ["Frac service pricing", "Proppant and chemical inflation", "Diesel/power surcharges"],
      capacityDrivers: ["Fleet utilization", "Sand rail/truck availability", "Water disposal constraints"],
      supplierBehavior: ["Bundled service offers", "Short-term price holds", "Equipment deployment shifts"],
      contractingImplications: ["Fleet reservation fees", "Volume-based discounts", "E-frac adoption clauses"],
      complianceTriggers: ["Water use restrictions", "Emissions rules", "Local permitting changes"]
    }
  },
  "pa-decommissioning": {
    focusAreas: ["Regulatory timelines", "Cost estimates", "Technology innovation", "Liability transfers", "Campaign scheduling"],
    keySuppliers: ["Petrofac", "Wood", "Worley", "Offshore Decom", "Well-Safe Solutions", "Claxton"],
    marketDrivers: ["Regulatory enforcement", "Late-life asset transfers", "Cost reduction pressure", "Reuse/recycle mandates", "Yard capacity"],
    procurementConsiderations: ["Long-term contracts vs campaigns", "Performance bonds", "HSE requirements", "Equipment availability", "Waste handling terms"],
    dailyCMLens: {
      costDrivers: ["Vessel day rates", "Waste handling fees", "Engineering manhour rates"],
      capacityDrivers: ["Heavy-lift vessel availability", "P&A rig slots", "Yard capacity"],
      supplierBehavior: ["Schedule risk buffers", "Contingency pricing", "JV consortium bids"],
      contractingImplications: ["Milestone payments", "Abandonment liability allocation", "Bonding requirements"],
      complianceTriggers: ["Regulator enforcement notices", "Decom timelines", "Environmental approvals"]
    }
  },
  "subsea-surf-offshore": {
    focusAreas: ["Vessel utilization", "Backlog trends", "Technology advances", "Project awards", "Installation schedules", "Lead time slippage"],
    keySuppliers: ["TechnipFMC", "Subsea 7", "Saipem", "Aker Solutions", "OneSubsea (SLB)", "Oceaneering"],
    marketDrivers: ["Deepwater project sanctions", "Vessel supply", "Steel prices", "Brownfield vs greenfield mix", "FPSO demand"],
    procurementConsiderations: ["EPCI vs split contracts", "Alliance models", "Technology access", "Local content", "Interface risk control"],
    dailyCMLens: {
      costDrivers: ["Vessel day rates", "Subsea equipment pricing", "Steel/fabrication inflation"],
      capacityDrivers: ["Installation vessel schedules", "Umbilical/flowline plant slots", "Engineering backlog"],
      supplierBehavior: ["Backlog-driven pricing", "Bundling SURF packages", "Lead-time extension requests"],
      contractingImplications: ["EPCI risk allocation", "Change order mechanics", "Liquidated damages"],
      complianceTriggers: ["Local content rules", "Subsea regulatory approvals", "HSE incident reports"]
    }
  },
  "projects-epc-epcm-construction": {
    focusAreas: ["Project sanctions", "Cost inflation", "Labor availability", "Module fabrication", "Schedule performance", "Yard capacity"],
    keySuppliers: ["Bechtel", "Fluor", "KBR", "Worley", "McDermott", "Technip Energies", "Samsung Heavy", "Chiyoda"],
    marketDrivers: ["LNG FID pipeline", "Decarbonization projects", "Cost escalation", "Supply chain constraints", "EPCM backlog"],
    procurementConsiderations: ["Contract structures (LSTK vs reimbursable)", "Risk allocation", "Contractor capacity", "Module strategy", "Schedule contingency"],
    dailyCMLens: {
      costDrivers: ["EPCM rates", "Commodity inflation", "Labor escalation"],
      capacityDrivers: ["Yard/fab slot availability", "Skilled labor availability", "Module logistics"],
      supplierBehavior: ["Bid selectivity", "Schedule contingency", "Alliance preference"],
      contractingImplications: ["LSTK vs reimbursable choice", "Change order protections", "Delay LDs"],
      complianceTriggers: ["Major project approvals", "Local content mandates", "Regulatory milestones"]
    }
  },
  "major-equipment-oem-ltsa": {
    focusAreas: ["Lead times", "Aftermarket pricing", "Technology transitions", "Spare parts availability", "LTSA renewals", "Component obsolescence"],
    keySuppliers: ["Siemens Energy", "GE Vernova", "Baker Hughes", "Sulzer", "Atlas Copco", "Mitsubishi", "Solar Turbines"],
    marketDrivers: ["Energy transition", "Installed base growth", "Supply chain recovery", "Decarbonization tech", "Outage schedules"],
    procurementConsiderations: ["OEM vs third-party parts", "LTSA optimization", "Technology upgrades", "Obsolescence management", "Service level guarantees"],
    dailyCMLens: {
      costDrivers: ["OEM parts pricing", "Service rate escalators", "FX on imported parts"],
      capacityDrivers: ["Shop slot availability", "Spare parts lead times", "Field service staffing"],
      supplierBehavior: ["LTSA upsell", "Bundled digital services", "Warranty extension offers"],
      contractingImplications: ["LTSA scope reset", "Parts indexation", "Obsolescence clauses"],
      complianceTriggers: ["Emissions standards", "Safety bulletins", "Reliability advisories"]
    }
  },
  "ops-maintenance-services": {
    focusAreas: ["Contractor safety performance", "Labor rates", "Asset integrity", "Turnaround planning", "Regulatory compliance", "Backlog coverage"],
    keySuppliers: ["Wood", "Worley", "Petrofac", "AKER", "Bilfinger", "Fluor", "Altrad"],
    marketDrivers: ["Asset age", "Regulatory requirements", "Labor availability", "Technology adoption (predictive maintenance)", "Unplanned outage risk"],
    procurementConsiderations: ["Outcome-based contracts", "Labor rates", "Mobilization costs", "Integration with operations", "Standby coverage"],
    dailyCMLens: {
      costDrivers: ["Labor rate shifts", "Overtime premiums", "Mobilization charges"],
      capacityDrivers: ["Skilled labor availability", "Turnaround windows", "Specialist crew supply"],
      supplierBehavior: ["Rate card updates", "Scope carve-outs", "Lead-time warnings"],
      contractingImplications: ["Outcome-based KPIs", "Standby retainer clauses", "Rate escalation triggers"],
      complianceTriggers: ["HSE audits", "Regulatory inspection findings", "Permit-to-work changes"]
    }
  },
  "mro-site-consumables": {
    focusAreas: ["Inventory optimization", "Lead times", "Price movements", "Supplier reliability", "Standardization", "Fill-rate performance"],
    keySuppliers: ["Grainger", "Fastenal", "WESCO", "Applied Industrial", "Motion Industries", "Crane", "Emerson (valves)"],
    marketDrivers: ["Steel prices", "Logistics costs", "Inventory strategies", "E-commerce adoption", "OEM supply tightness"],
    procurementConsiderations: ["VMI programs", "Consignment", "Catalog management", "Supplier consolidation", "Substitution controls"],
    dailyCMLens: {
      costDrivers: ["Catalog price moves", "Steel-linked components", "Freight surcharges"],
      capacityDrivers: ["Lead time shifts", "Distribution center fill rates", "Supplier allocation status"],
      supplierBehavior: ["Minimum order changes", "Substitution proposals", "Backorder notices"],
      contractingImplications: ["VMI/consignment terms", "Price hold periods", "Substitution approvals"],
      complianceTriggers: ["Product safety recalls", "Specification changes", "Import compliance updates"]
    }
  },
  "logistics-marine-aviation": {
    focusAreas: ["Freight rates", "Vessel availability", "Port congestion", "Aviation capacity", "Fuel costs", "Crew availability"],
    keySuppliers: ["Maersk", "MSC", "CMA CGM", "CHC", "Bristow", "Swire Pacific Offshore", "Tidewater"],
    marketDrivers: ["Fuel prices", "Charter rates", "Trade flows", "Weather patterns", "Regulatory (IMO 2020)", "Seasonality"],
    procurementConsiderations: ["Spot vs term contracts", "Fuel surcharges", "Route optimization", "Helicopter vs vessel mix", "Slot guarantees"],
    dailyCMLens: {
      costDrivers: ["Bunker fuel pricing", "Charter rate swings", "Airport/port fees"],
      capacityDrivers: ["Vessel availability", "Flight hours/crew limits", "Port congestion"],
      supplierBehavior: ["Surcharge updates", "Allocation notices", "Spot market offers"],
      contractingImplications: ["Fuel indexation", "Minimum volume commitments", "Cancellation terms"],
      complianceTriggers: ["IMO/aviation rule changes", "Weather disruption alerts", "Port authority directives"]
    }
  },
  "site-services-facilities": {
    focusAreas: ["Camp occupancy", "Catering costs", "Waste disposal rates", "Security incidents", "HSE compliance", "Mobilization timelines"],
    keySuppliers: ["Sodexo", "Compass Group", "ATCO", "Target Logistics", "Vivo Energy", "Cleanaway"],
    marketDrivers: ["Project activity levels", "Labor camp requirements", "Regulatory compliance", "Cost pressure", "Travel restrictions"],
    procurementConsiderations: ["Integrated FM vs discrete", "Cost per head", "Service levels", "Sustainability requirements", "Penalty/credit terms"],
    dailyCMLens: {
      costDrivers: ["Food and fuel inflation", "Waste handling fees", "Camp staffing costs"],
      capacityDrivers: ["Camp occupancy", "Service crew availability", "Accommodation lead times"],
      supplierBehavior: ["Scope change requests", "Price reset notices", "Resource constraints"],
      contractingImplications: ["Per-head pricing adjustments", "Service level credits", "Standby clauses"],
      complianceTriggers: ["HSE inspections", "Food safety advisories", "Waste regulation changes"]
    }
  },
  "market-dashboard": {
    focusAreas: ["Commodity prices", "Market sentiment", "Macroeconomic indicators", "Geopolitical events", "Industry outlook", "Forward curves"],
    keySuppliers: [],
    marketDrivers: ["Oil/gas prices", "OPEC policy", "Demand growth", "Energy transition", "Geopolitics", "FX volatility"],
    procurementConsiderations: ["Budget planning", "Forward purchasing", "Risk hedging", "Supplier negotiations", "Index selection"],
    dailyCMLens: {
      costDrivers: ["Benchmark price moves", "FX and inflation", "Freight indices"],
      capacityDrivers: ["Global supply/demand balance", "Refinery/utilization signals", "Storage levels"],
      supplierBehavior: ["Price guidance shifts", "Production discipline messaging", "Contract posture"],
      contractingImplications: ["Indexation triggers", "Hedging opportunities", "Term vs spot balance"],
      complianceTriggers: ["Sanctions updates", "Regulatory policy shifts", "Trade restrictions"]
    }
  },
  "it-telecom-cyber": {
    focusAreas: ["Cyber threats (OT/IT)", "Network infrastructure", "Cloud migration", "Vendor security posture", "Compliance", "Renewal timing"],
    keySuppliers: ["Microsoft", "Cisco", "Palo Alto", "CrowdStrike", "Zscaler", "ServiceNow", "SAP", "Verizon", "Telstra"],
    marketDrivers: ["Threat landscape", "Regulatory requirements", "Digital transformation", "Remote operations", "Vendor consolidation"],
    procurementConsiderations: ["Security assessments", "Multi-vendor integration", "Contract flexibility", "Incident response", "Data residency terms"],
    dailyCMLens: {
      costDrivers: ["License renewals", "Cloud consumption spikes", "Managed service rates"],
      capacityDrivers: ["Vendor support coverage", "SOC staffing availability", "Hardware lead times"],
      supplierBehavior: ["Renewal uplift asks", "Bundling platform offers", "Security advisory cadence"],
      contractingImplications: ["Breach response SLAs", "Price caps/collars", "Exit/portability clauses"],
      complianceTriggers: ["Regulatory cyber advisories", "Privacy rule changes", "Critical vulnerability alerts"]
    }
  },
  "professional-services-hr": {
    focusAreas: ["Labor market trends", "Rate inflation", "Regulatory changes", "Workforce planning", "Contractor compliance", "Utilization benchmarks"],
    keySuppliers: ["Accenture", "Deloitte", "EY", "McKinsey", "Robert Half", "Hays", "Manpower", "Baker McKenzie"],
    marketDrivers: ["Talent availability", "Wage inflation", "Remote work policies", "Regulatory changes", "Hiring freeze signals"],
    procurementConsiderations: ["Rate benchmarking", "Statement of work clarity", "Preferred supplier panels", "IR compliance", "Rate card governance"],
    dailyCMLens: {
      costDrivers: ["Bill rate inflation", "Specialist premium rates", "Travel costs"],
      capacityDrivers: ["Talent scarcity", "Bench availability", "Project pipeline demand"],
      supplierBehavior: ["Rate card updates", "SOW scope creep", "Preferred supplier positioning"],
      contractingImplications: ["Rate caps", "Milestone-based payments", "Substitution/bench clauses"],
      complianceTriggers: ["IR/contractor compliance changes", "Labor law updates", "Visa/immigration policy shifts"]
    }
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
    `Daily CM Lens — Cost drivers: ${context.dailyCMLens.costDrivers.join(", ")}. Capacity/utilization drivers: ${context.dailyCMLens.capacityDrivers.join(", ")}. Supplier behavior: ${context.dailyCMLens.supplierBehavior.join(", ")}. Contracting implications: ${context.dailyCMLens.contractingImplications.join(", ")}. Compliance/regulatory triggers: ${context.dailyCMLens.complianceTriggers.join(", ")}.`,
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
