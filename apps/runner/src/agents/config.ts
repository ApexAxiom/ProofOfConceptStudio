import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { AgentConfig, AgentFeed, RegionSlug, validateAgentConfig } from "@proof/shared";

export interface AgentRegion {
  agent: AgentConfig;
  region: RegionSlug;
  feeds: AgentFeed[];
}

export function loadAgents(): AgentConfig[] {
  const file = path.join(process.cwd(), "src", "agents", "agents.yaml");
  const raw = fs.readFileSync(file, "utf-8");
  const data = YAML.parse(raw) as AgentConfig[];
  return data.map(validateAgentConfig);
}

export function expandAgentsByRegion(options?: { agents?: AgentConfig[]; regions?: RegionSlug[] }): AgentRegion[] {
  const agents = options?.agents ?? loadAgents();
  const regionFilter = options?.regions ? new Set(options.regions) : null;

  return agents.flatMap((agent) =>
    (Object.entries(agent.feedsByRegion) as [RegionSlug, AgentFeed[]][]) // Limit to defined region keys
      .filter(([region]) => !regionFilter || regionFilter.has(region))
      .map(([region, feeds]) => ({ agent, region, feeds }))
  );
}
