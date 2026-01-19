export interface PortfolioPlaybook {
  kpis: string[];
  levers: string[];
}

const PLAYBOOKS: Record<string, PortfolioPlaybook> = {
  "rigs-integrated-drilling": {
    kpis: [
      "Regional rig utilization %",
      "Dayrate trend",
      "Tender count vs awarded count"
    ],
    levers: [
      "Termination-for-convenience and standby rate clauses",
      "Fuel/mobilization indexation with caps",
      "Supplier capacity signals (stacked rig reactivations)",
      "Contract flexibility for mobilization windows",
      "Performance-based incentives tied to uptime"
    ]
  },
  "drilling-services": {
    kpis: [
      "Directional tools lead times",
      "Cement/fluids availability",
      "Service crew utilization"
    ],
    levers: [
      "Bundle vs unbundle service lines",
      "Performance-based pricing (ROP, NPT)",
      "Spare/consumable buffers",
      "Defined response time SLAs",
      "Rigsite staffing continuity clauses"
    ]
  },
  "wells-materials-octg": {
    kpis: [
      "OCTG lead times",
      "HRC index",
      "Tariff/trade actions",
      "Mill capacity utilization"
    ],
    levers: [
      "Dual-sourcing by mill + threading",
      "Inventory min/max policy",
      "Contract indexation with caps/collars",
      "Qualification of alternate grades",
      "MOQ and batch size flexibility"
    ]
  },
  "completions-intervention": {
    kpis: [
      "Frac fleet utilization",
      "Sand/proppant price index",
      "Chemicals availability",
      "Trucking constraints"
    ],
    levers: [
      "Define stage counts and scope",
      "Lock in logistics capacity",
      "Idle time/NPT negotiation levers",
      "Service bundling for scheduling priority",
      "Material substitution approvals"
    ]
  },
  "pa-decommissioning": {
    kpis: [
      "Campaign vessel availability",
      "Regulatory deadlines",
      "Dayrate trends"
    ],
    levers: [
      "Campaign bundling (multi-well)",
      "Clear acceptance criteria",
      "Liability/insurance clauses",
      "Scope-change governance",
      "Regulator engagement cadence"
    ]
  },
  "subsea-surf-offshore": {
    kpis: [
      "Vessel dayrates",
      "Subsea tree lead times",
      "Umbilical/flexible pipe backlog"
    ],
    levers: [
      "Long-lead procurement triggers",
      "OEM bottleneck mapping",
      "Weather downtime terms",
      "Vessel availability commitments",
      "Spare criticality definitions"
    ]
  },
  "projects-epc-epcm-construction": {
    kpis: [
      "Craft wage index",
      "Backlog",
      "Productivity trend",
      "Commodity inflation inputs"
    ],
    levers: [
      "Escalation clauses (labor/material)",
      "Milestone-based payments",
      "LDs aligned to critical path risk",
      "Productivity benchmarking",
      "Scope freeze governance"
    ]
  },
  "major-equipment-oem-ltsa": {
    kpis: [
      "OEM lead times",
      "Spares criticality",
      "Failure rates",
      "LTSA cost escalation drivers"
    ],
    levers: [
      "Spares pricing transparency",
      "Response time guarantees",
      "Parts obsolescence management",
      "Availability-based rebates",
      "Lifecycle service bundling"
    ]
  },
  "ops-maintenance-services": {
    kpis: [
      "Labor rates",
      "Incident/regulatory alerts",
      "Turnaround schedule pressure"
    ],
    levers: [
      "Rate cards with skill mix",
      "Mobilization cost controls",
      "Compliance-ready supplier requirements",
      "Penalty/bonus performance terms",
      "Crew continuity clauses"
    ]
  },
  "mro-site-consumables": {
    kpis: [
      "HRC/ferrous indices",
      "Supplier fill rate",
      "Lead times by class",
      "Freight fuel surcharges"
    ],
    levers: [
      "VMI/consignment",
      "SKU standardization",
      "Index-linked price adjustments",
      "Service level penalties",
      "Catalog rationalization"
    ]
  },
  "logistics-marine-aviation": {
    kpis: [
      "Freight indices",
      "Port congestion metrics",
      "Bunker fuel",
      "Equipment availability (containers)"
    ],
    levers: [
      "Routing flexibility clauses",
      "Split awards by lane",
      "Fuel surcharge governance",
      "Priority capacity options",
      "Carrier performance scorecards"
    ]
  },
  "site-services-facilities": {
    kpis: [
      "Compliance cost drivers",
      "Regional disposal fees",
      "Labor availability"
    ],
    levers: [
      "SOW standardization",
      "Compliance obligations as SLAs",
      "Competitive benchmarking by site",
      "Mobilization time targets",
      "Audit-ready documentation"
    ]
  },
  "it-telecom-cyber": {
    kpis: [
      "CVE severity count",
      "Patch SLA compliance",
      "Vendor incident history"
    ],
    levers: [
      "Vendor security addendum",
      "Audit rights",
      "Time-to-patch SLAs",
      "Tabletop incident readiness",
      "Escalation paths for breaches"
    ]
  },
  "professional-services-hr": {
    kpis: [
      "Wage inflation indices",
      "Bill rates by role",
      "Time-to-fill",
      "Contractor churn"
    ],
    levers: [
      "Rate card refresh cadence",
      "Outcome-based SOWs",
      "Compliance/co-employment checks",
      "Talent pipeline commitments",
      "Volume discounts by role"
    ]
  }
};

export function getPortfolioPlaybook(portfolio: string): PortfolioPlaybook | null {
  return PLAYBOOKS[portfolio] ?? null;
}
