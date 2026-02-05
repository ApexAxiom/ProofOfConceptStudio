import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import {
  AgentConfig,
  AgentFeed,
  RegionSlug,
  getGoogleNewsFeeds,
  getPortfolioCatalog,
  getPortfolioSources,
  validateAgentConfig
} from "@proof/shared";

export interface AgentRegion {
  agent: AgentConfig;
  region: RegionSlug;
  feeds: AgentFeed[];
}

const KNOWN_REGIONS: RegionSlug[] = ["au", "us-mx-la-lng"];

function normalizeUrl(url: string): string {
  try {
    return new URL(url).toString();
  } catch {
    return url.trim();
  }
}

function dedupeFeeds(feeds: AgentFeed[]): AgentFeed[] {
  const seen = new Set<string>();
  return feeds.filter((feed) => {
    const key = `${feed.type}:${normalizeUrl(feed.url)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function regionToSourceRegion(region: RegionSlug): "apac" | "intl" {
  return region === "au" ? "apac" : "intl";
}

function toFeed(source: { name: string; url: string; rssUrl?: string }): AgentFeed {
  const url = source.rssUrl ?? source.url;
  return {
    name: source.name,
    url,
    type: source.rssUrl ? "rss" : "web"
  };
}

function feedsFromPortfolioCatalog(portfolio: string, region: RegionSlug): AgentFeed[] {
  const sourceRegion = regionToSourceRegion(region);
  const baseSources = getPortfolioSources(portfolio, sourceRegion);
  const googleSources = getGoogleNewsFeeds(portfolio, sourceRegion);
  return dedupeFeeds([...baseSources, ...googleSources].map(toFeed));
}

function assertAgentCatalogParity(agents: AgentConfig[]): void {
  const catalog = getPortfolioCatalog();
  const catalogPortfolios = new Set(catalog.map((entry) => entry.slug));
  const agentPortfolios = new Set(agents.map((agent) => agent.portfolio));

  const missingAgents = [...catalogPortfolios].filter((slug) => !agentPortfolios.has(slug));
  if (missingAgents.length > 0) {
    throw new Error(`Agent catalog mismatch: missing agents for portfolios: ${missingAgents.join(", ")}`);
  }

  const unknownAgents = [...agentPortfolios].filter((slug) => !catalogPortfolios.has(slug));
  if (unknownAgents.length > 0) {
    throw new Error(`Agent catalog mismatch: unknown agent portfolios: ${unknownAgents.join(", ")}`);
  }
}

function hydrateAgentFeeds(agent: AgentConfig): AgentConfig {
  const feedsByRegion = Object.fromEntries(
    KNOWN_REGIONS.map((region) => {
      const yamlFeeds = Array.isArray(agent.feedsByRegion?.[region]) ? agent.feedsByRegion[region] : [];
      const catalogFeeds = feedsFromPortfolioCatalog(agent.portfolio, region);
      const mergedFeeds = dedupeFeeds([...yamlFeeds, ...catalogFeeds]);
      return [region, mergedFeeds];
    })
  ) as Record<RegionSlug, AgentFeed[]>;

  return {
    ...agent,
    feedsByRegion
  };
}

export function loadAgents(): AgentConfig[] {
  const file = path.join(process.cwd(), "src", "agents", "agents.yaml");
  const raw = fs.readFileSync(file, "utf-8");
  const data = YAML.parse(raw) as AgentConfig[];
  const hydrated = data.map(hydrateAgentFeeds);
  assertAgentCatalogParity(hydrated);
  return hydrated.map(validateAgentConfig);
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
