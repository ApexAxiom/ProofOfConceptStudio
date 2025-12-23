import { AgentConfig } from "./types.js";

/**
 * Light validation helper to ensure agent configs carry required fields.
 */
export function validateAgentConfig(config: AgentConfig): AgentConfig {
  if (!config.id || !config.portfolio) {
    throw new Error("Agent config missing id or portfolio");
  }
  if (!config.feedsByRegion) {
    throw new Error(`Agent ${config.id} missing feedsByRegion`);
  }
  return config;
}
