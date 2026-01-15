/**
 * Category classification and color utilities for portfolio categorization.
 * Use this shared utility instead of duplicating getCategoryColor logic across components.
 */

export type CategoryGroup = "energy" | "steel" | "freight" | "services" | "cyber" | "facility";

export interface CategoryMeta {
  id: CategoryGroup;
  label: string;
  color: string;
  lightBg: string;
  lightText: string;
  darkBg: string;
  darkText: string;
}

export const CATEGORY_META: Record<CategoryGroup, CategoryMeta> = {
  energy: {
    id: "energy",
    label: "Energy",
    color: "#f59e0b",
    lightBg: "bg-amber-100",
    lightText: "text-amber-700",
    darkBg: "dark:bg-amber-500/20",
    darkText: "dark:text-amber-400"
  },
  steel: {
    id: "steel",
    label: "Steel & Materials",
    color: "#6b7280",
    lightBg: "bg-slate-100",
    lightText: "text-slate-600",
    darkBg: "dark:bg-slate-500/20",
    darkText: "dark:text-slate-300"
  },
  freight: {
    id: "freight",
    label: "Freight & Logistics",
    color: "#0891b2",
    lightBg: "bg-cyan-100",
    lightText: "text-cyan-700",
    darkBg: "dark:bg-cyan-500/20",
    darkText: "dark:text-cyan-400"
  },
  services: {
    id: "services",
    label: "Professional Services",
    color: "#7c3aed",
    lightBg: "bg-violet-100",
    lightText: "text-violet-700",
    darkBg: "dark:bg-violet-500/20",
    darkText: "dark:text-violet-400"
  },
  cyber: {
    id: "cyber",
    label: "IT & Cyber",
    color: "#059669",
    lightBg: "bg-emerald-100",
    lightText: "text-emerald-700",
    darkBg: "dark:bg-emerald-500/20",
    darkText: "dark:text-emerald-400"
  },
  facility: {
    id: "facility",
    label: "Facilities",
    color: "#db2777",
    lightBg: "bg-pink-100",
    lightText: "text-pink-700",
    darkBg: "dark:bg-pink-500/20",
    darkText: "dark:text-pink-400"
  }
};

const PORTFOLIO_CATEGORY_MAP: Record<string, CategoryGroup> = {
  "rigs-integrated-drilling": "energy",
  "drilling-services": "energy",
  "wells-materials-octg": "steel",
  "completions-intervention": "energy",
  "pa-decommissioning": "energy",
  "subsea-surf-offshore": "energy",
  "projects-epc-epcm-construction": "energy",
  "major-equipment-oem-ltsa": "energy",
  "ops-maintenance-services": "energy",
  "mro-site-consumables": "steel",
  "logistics-marine-aviation": "freight",
  "site-services-facilities": "facility",
  "market-dashboard": "energy",
  "it-telecom-cyber": "cyber",
  "professional-services-hr": "services"
};

/**
 * Determines the category group for a given portfolio slug.
 */
export function categoryForPortfolio(slug: string): CategoryGroup {
  const lowerSlug = slug.toLowerCase();
  const mapped = PORTFOLIO_CATEGORY_MAP[lowerSlug];
  if (mapped) {
    return mapped;
  }
  
  // Energy-related portfolios
  if (
    lowerSlug.includes("drill") ||
    lowerSlug.includes("rig") ||
    lowerSlug.includes("wells") ||
    lowerSlug.includes("complet") ||
    lowerSlug.includes("subsea") ||
    lowerSlug.includes("project") ||
    lowerSlug.includes("equipment") ||
    lowerSlug.includes("decom") ||
    lowerSlug.includes("ops") ||
    lowerSlug.includes("maintenance") ||
    lowerSlug.includes("market-dashboard")
  ) {
    return "energy";
  }
  
  // Freight/Logistics
  if (
    lowerSlug.includes("logistics") ||
    lowerSlug.includes("marine") ||
    lowerSlug.includes("aviation")
  ) {
    return "freight";
  }
  
  // Cyber/IT
  if (
    lowerSlug.includes("cyber") ||
    lowerSlug.includes("it") ||
    lowerSlug.includes("telecom")
  ) {
    return "cyber";
  }
  
  // Facility
  if (
    lowerSlug.includes("facility") ||
    lowerSlug.includes("site")
  ) {
    return "facility";
  }

  // Professional Services
  if (
    lowerSlug.includes("services") ||
    lowerSlug.includes("hr") ||
    lowerSlug.includes("professional")
  ) {
    return "services";
  }
  
  // Steel/Materials
  if (
    lowerSlug.includes("mro") ||
    lowerSlug.includes("materials") ||
    lowerSlug.includes("octg")
  ) {
    return "steel";
  }
  
  // Default to energy
  return "energy";
}

/**
 * Get the full category metadata for a portfolio slug.
 */
export function getCategoryMeta(slug: string): CategoryMeta {
  return CATEGORY_META[categoryForPortfolio(slug)];
}

/**
 * Get the badge CSS class for a category.
 */
export function getCategoryBadgeClass(slug: string): string {
  const category = categoryForPortfolio(slug);
  return `badge-${category}`;
}
