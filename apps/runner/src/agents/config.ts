import { expandAgentCatalogByRegion, loadAgentCatalog, type AgentRegion } from "@proof/shared";

export type { AgentRegion };

export const loadAgents = loadAgentCatalog;
export const expandAgentsByRegion = expandAgentCatalogByRegion;
