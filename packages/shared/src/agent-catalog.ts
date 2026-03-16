import { getGoogleNewsFeeds, getPortfolioSources } from "./portfolio-sources.js";
import { getPortfolioCatalog } from "./portfolio-catalog.js";
import { validateAgentConfig } from "./agent-schema.js";
import { RAW_AGENT_CATALOG } from "./generated-agent-catalog.js";
import type { AgentConfig, AgentFeed } from "./types.js";
import type { RegionSlug } from "./regions.js";

export interface AgentRegion {
  agent: AgentConfig;
  region: RegionSlug;
  feeds: AgentFeed[];
}

export interface AgentCatalogSummary {
  id: string;
  region: RegionSlug;
  portfolio: string;
  label: string;
  description?: string;
  maxArticlesToConsider?: number;
  articlesPerRun: number;
  feeds?: AgentFeed[];
}

const KNOWN_REGIONS: RegionSlug[] = ["au", "us-mx-la-lng"];
const GOOGLE_NEWS_ENABLED = (process.env.GOOGLE_NEWS_ENABLED ?? "false").toLowerCase() === "true";

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

function feedsFromGoogleCatalog(portfolio: string, region: RegionSlug): AgentFeed[] {
  if (!GOOGLE_NEWS_ENABLED) return [];
  const sourceRegion = regionToSourceRegion(region);
  const googleSources = getGoogleNewsFeeds(portfolio, sourceRegion);
  return dedupeFeeds(googleSources.map(toFeed));
}

function feedsFromPortfolioCatalog(portfolio: string, region: RegionSlug): AgentFeed[] {
  const sourceRegion = regionToSourceRegion(region);
  return dedupeFeeds(getPortfolioSources(portfolio, sourceRegion).map(toFeed));
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
      const catalogFeeds = feedsFromPortfolioCatalog(agent.portfolio, region);
      const googleFeeds = feedsFromGoogleCatalog(agent.portfolio, region);
      const configuredFeeds = Array.isArray(agent.feedsByRegion?.[region]) ? agent.feedsByRegion[region] : [];
      const mergedFeeds = dedupeFeeds([...configuredFeeds, ...catalogFeeds, ...googleFeeds]);
      return [region, mergedFeeds];
    })
  ) as Record<RegionSlug, AgentFeed[]>;

  return {
    ...agent,
    feedsByRegion
  };
}

export function loadAgentCatalog(): AgentConfig[] {
  const hydrated = RAW_AGENT_CATALOG.map(hydrateAgentFeeds);
  assertAgentCatalogParity(hydrated);
  return hydrated.map(validateAgentConfig);
}

export function expandAgentCatalogByRegion(options?: {
  agents?: AgentConfig[];
  regions?: RegionSlug[];
}): AgentRegion[] {
  const agents = options?.agents ?? loadAgentCatalog();
  const regionFilter = options?.regions ? new Set(options.regions) : null;

  return agents.flatMap((agent) =>
    (Object.entries(agent.feedsByRegion) as [RegionSlug, AgentFeed[]][])
      .filter(([region]) => !regionFilter || regionFilter.has(region))
      .map(([region, feeds]) => ({ agent, region, feeds }))
  );
}

export function listAgentSummaries(options?: {
  includeFeeds?: boolean;
  agents?: AgentConfig[];
  regions?: RegionSlug[];
}): AgentCatalogSummary[] {
  const expanded = expandAgentCatalogByRegion({
    agents: options?.agents,
    regions: options?.regions
  });

  return expanded.map(({ agent, region, feeds }) => ({
    id: agent.id,
    region,
    portfolio: agent.portfolio,
    label: agent.label,
    description: agent.description,
    maxArticlesToConsider: agent.maxArticlesToConsider,
    articlesPerRun: agent.articlesPerRun,
    feeds: options?.includeFeeds ? feeds : undefined
  }));
}

export function findAgentSummary(params: {
  agentId?: string;
  portfolio?: string;
  region?: string;
}): AgentCatalogSummary | undefined {
  const agents = listAgentSummaries({ includeFeeds: true });
  const region = KNOWN_REGIONS.find((value) => value === params.region);
  const byIdAndRegion =
    params.agentId && region ? agents.find((agent) => agent.id === params.agentId && agent.region === region) : undefined;
  const byId = params.agentId ? agents.find((agent) => agent.id === params.agentId) : undefined;
  const byPortfolioAndRegion =
    params.portfolio && region
      ? agents.find((agent) => agent.portfolio === params.portfolio && agent.region === region)
      : undefined;
  const byPortfolio = params.portfolio ? agents.find((agent) => agent.portfolio === params.portfolio) : undefined;

  return byIdAndRegion ?? byId ?? byPortfolioAndRegion ?? byPortfolio;
}
