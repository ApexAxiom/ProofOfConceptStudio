import { AgentConfig } from "./types.js";
import { RegionSlug } from "./regions.js";

/**
 * Known regions that must have feed configurations
 */
const REQUIRED_REGIONS: RegionSlug[] = ["au", "us-mx-la-lng"];

/**
 * Validation helper to ensure agent configs carry required fields and are well-formed.
 * Catches configuration issues early during agent loading.
 */
export function validateAgentConfig(config: AgentConfig): AgentConfig {
  const errors: string[] = [];
  
  // Required fields
  if (!config.id) {
    errors.push("Missing required field: id");
  }
  if (!config.portfolio) {
    errors.push("Missing required field: portfolio");
  }
  if (!config.label) {
    errors.push("Missing required field: label");
  }
  if (!config.description) {
    errors.push("Missing required field: description");
  }
  
  // Validate feedsByRegion structure
  if (!config.feedsByRegion) {
    errors.push("Missing required field: feedsByRegion");
  } else {
    // Check if at least one region has feeds configured
    const configuredRegions = Object.keys(config.feedsByRegion) as RegionSlug[];
    if (configuredRegions.length === 0) {
      errors.push("feedsByRegion must have at least one region configured");
    }
    
    // Validate each region's feed configuration
    for (const region of configuredRegions) {
      const feeds = config.feedsByRegion[region];
      if (!Array.isArray(feeds)) {
        errors.push(`feedsByRegion.${region} must be an array`);
        continue;
      }
      
      // For non-dashboard agents, warn if feeds are empty for a region
      if (config.mode !== "market-dashboard" && feeds.length === 0) {
        console.warn(`[${config.id}] Region ${region} has no feeds configured`);
      }
      
      // Validate each feed has required fields
      for (let i = 0; i < feeds.length; i++) {
        const feed = feeds[i];
        if (!feed.name) {
          errors.push(`feedsByRegion.${region}[${i}] missing required field: name`);
        }
        if (!feed.url) {
          errors.push(`feedsByRegion.${region}[${i}] missing required field: url`);
        }
        if (!feed.type || !["rss", "web"].includes(feed.type)) {
          errors.push(`feedsByRegion.${region}[${i}] type must be "rss" or "web"`);
        }
        
        // Validate URL format
        if (feed.url) {
          try {
            new URL(feed.url);
          } catch {
            errors.push(`feedsByRegion.${region}[${i}] has invalid URL: ${feed.url}`);
          }
        }
      }
    }
  }
  
  // Validate numeric fields
  if (config.maxArticlesToConsider !== undefined && 
      (typeof config.maxArticlesToConsider !== "number" || config.maxArticlesToConsider < 1)) {
    errors.push("maxArticlesToConsider must be a positive number");
  }
  if (config.articlesPerRun !== undefined && 
      (typeof config.articlesPerRun !== "number" || config.articlesPerRun < 1 || config.articlesPerRun > 5)) {
    errors.push("articlesPerRun must be between 1 and 5");
  }
  if (config.lookbackDays !== undefined && 
      (typeof config.lookbackDays !== "number" || config.lookbackDays < 1)) {
    errors.push("lookbackDays must be a positive number");
  }
  
  // Validate mode if specified
  if (config.mode !== undefined && !["brief", "market-dashboard"].includes(config.mode)) {
    errors.push('mode must be "brief" or "market-dashboard"');
  }
  
  if (errors.length > 0) {
    throw new Error(`Agent config validation failed for "${config.id || 'unknown'}":\n  - ${errors.join("\n  - ")}`);
  }
  
  return config;
}
