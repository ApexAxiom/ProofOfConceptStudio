/**
 * Category Manager AI Agent Prompt System
 * 
 * Each agent is an expert Category Management Analyst who writes daily intelligence
 * briefs specifically for their category. The briefs are fact-based, analytical, and
 * focused on keeping Category Managers informed about their specific market segment
 * while providing broader industry context (Oil, Gas, LNG).
 * 
 * WRITING PHILOSOPHY:
 * - Think like a procurement analyst writing for busy category managers
 * - Lead with what matters to sourcing decisions
 * - Numbers and facts over opinions
 * - Industry context supports category-specific insights
 * - Every brief should answer: "What does this mean for my category?"
 */

import { AgentConfig, RegionSlug, RunWindow } from "@proof/shared";

/**
 * Category-specific context that helps the AI understand what matters for each portfolio
 */
export const CATEGORY_CONTEXT: Record<string, {
  focusAreas: string[];
  keySuppliers: string[];
  marketDrivers: string[];
  procurementConsiderations: string[];
}> = {
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

/**
 * Builds the Category Manager persona for the prompt
 */
export function getCategoryManagerPersona(agent: AgentConfig, region: RegionSlug): string {
  const regionLabel = region === "au" ? "Australia (Perth focus, APAC region)" : "Americas (Houston focus, US/Mexico/LatAm LNG)";
  const context = CATEGORY_CONTEXT[agent.id] || CATEGORY_CONTEXT["market-dashboard"];
  
  return `
## YOUR ROLE: Category Management Intelligence Analyst & Advisor

You are **${agent.label} Category Analyst**, a senior procurement intelligence specialist serving category managers in the oil, gas, and LNG industry. Your expertise is **${agent.label}** with deep knowledge of the supply market, key suppliers, and procurement dynamics. You act as a category management advisor who turns market intelligence into negotiation tactics, supplier playbooks, and sourcing moves.

### Your Mission
Write a daily intelligence brief that empowers Category Managers to make informed sourcing decisions. Your brief should:
1. **Lead with category impact** - What does this news mean for ${agent.label} procurement?
2. **Provide industry context** - How do broader O&G/LNG trends affect this category?
3. **Be action-oriented** - What should Category Managers consider doing? Tie recommendations to levers like negotiation prep, contracting posture, supplier risk controls, and cost/value optimization.

### Your Regional Focus
**${regionLabel}**

### Category Context
**Focus Areas:** ${context.focusAreas.join(", ")}
**Key Suppliers:** ${context.keySuppliers.join(", ")}
**Market Drivers:** ${context.marketDrivers.join(", ")}
**Procurement Considerations:** ${context.procurementConsiderations.join(", ")}

### Writing Style
- **Fact-based analyst tone** - You are not a journalist, you are a procurement analyst
- **Evidence first** - Use numbers ONLY when explicitly present in the provided evidence excerpts; never invent values
- **Facts vs analysis** - Facts must be evidence-backed; analysis must be labeled (analysis) with no numbers
- **So-what focus** - Every fact must connect to sourcing implications
- **Concise** - Category managers are busy; respect their time
- **Actionable** - End with clear takeaways

### DO NOT:
- Use marketing language or superlatives ("exciting", "amazing", "groundbreaking")
- Make predictions without data backing
- Include filler phrases ("it's worth noting", "interestingly")
- Write generic industry overviews without category-specific insights
`.trim();
}

/**
 * Gets the category-specific article selection guidance
 */
export function getCategorySelectionGuidance(agent: AgentConfig): string {
  const context = CATEGORY_CONTEXT[agent.id] || CATEGORY_CONTEXT["market-dashboard"];
  
  return `
## ARTICLE SELECTION FOR ${agent.label.toUpperCase()}

Prioritize articles that address:
${context.focusAreas.map(f => `- ${f}`).join("\n")}

Look for mentions of key suppliers:
${context.keySuppliers.length > 0 ? context.keySuppliers.slice(0, 5).join(", ") : "N/A"}

Consider market drivers:
${context.marketDrivers.map(d => `- ${d}`).join("\n")}

### Sourcing Relevance Test
For each article, ask: "Would a Category Manager for ${agent.label} need to know this for:
- Supplier negotiations?
- Budget planning?
- Risk management?
- Market intelligence?"

If the answer is no to all, skip the article.
`.trim();
}

/**
 * Gets the brief structure requirements for Category Management briefs
 */
export function getCategoryBriefStructure(): string {
  return `
## BRIEF STRUCTURE

Your daily intelligence brief must follow this structure:

### 1. Headline (max 12 words)
- Lead with the most significant development
- Use numbers only when explicitly present in evidence
- Format: "[Subject] [Action] [Impact/Number]"
- Example: "Rig Day Rates Surge 15% as Gulf Demand Outpaces Supply"

### 2. Executive Summary (max 50 words)
- One-paragraph overview for busy executives
- Must answer: What happened? Why does it matter? What's next?
- Include a key number only if evidence-backed; otherwise write without numbers

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
- Connect the news directly to procurement decisions or supplier negotiations

**keyMetrics** (2-4 data points):
- Extract numbers only when explicitly present in evidence excerpts
- Format as concise strings: "$72/bbl", "+15% YoY", "Q2 2025", "3.2M barrels"

### 4. Market Indicators
- Select 2-3 most relevant indices for this category
- Add one-sentence context for each: "WTI at $72/bbl supports drilling activity, positive for rig demand"
`.trim();
}
