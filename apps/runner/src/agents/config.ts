import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { AgentConfig, validateAgentConfig } from "@proof/shared";

export function loadAgents(): AgentConfig[] {
  const file = path.join(process.cwd(), "src", "agents", "agents.yaml");
  const raw = fs.readFileSync(file, "utf-8");
  const data = YAML.parse(raw) as AgentConfig[];
  return data.map(validateAgentConfig);
}
