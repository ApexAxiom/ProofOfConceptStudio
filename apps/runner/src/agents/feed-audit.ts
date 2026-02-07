import { AgentFeed, RegionSlug } from "@proof/shared";
import { loadAgents } from "./config.js";

interface FeedCheckResult {
  ok: boolean;
  reason?: string;
  contentType?: string;
  itemCount?: number;
}

interface AgentRegionAudit {
  agentId: string;
  region: RegionSlug;
  totalFeeds: number;
  usableFeeds: number;
  failingFeeds: number;
  coreFeeds: number;
  coreUsableFeeds: number;
  coreFailingFeeds: number;
  supplementalFeeds: number;
  supplementalUsableFeeds: number;
  supplementalFailingFeeds: number;
}

interface FailedFeed {
  agentId: string;
  region: RegionSlug;
  name: string;
  url: string;
  reason: string;
  supplemental: boolean;
}

interface AuditOptions {
  minCoreFeeds: number;
  minCoreUsable: number;
  timeoutMs: number;
  concurrency: number;
  maxFailureLines: number;
}

type RunnerAgent = ReturnType<typeof loadAgents>[number];
const GOOGLE_NEWS_ENABLED = (process.env.GOOGLE_NEWS_ENABLED ?? "false").toLowerCase() === "true";

function normalizeFeedUrl(url: string): string {
  try {
    return new URL(url).toString();
  } catch {
    return url.trim();
  }
}

function dedupeFeeds(feeds: AgentFeed[]): AgentFeed[] {
  const seen = new Set<string>();
  return feeds.filter((feed) => {
    const key = normalizeFeedUrl(feed.url);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isSupplementalFeed(feed: AgentFeed): boolean {
  try {
    const host = new URL(feed.url).hostname.replace(/^www\./, "").toLowerCase();
    return host === "news.google.com";
  } catch {
    return false;
  }
}

function getRuntimeFeeds(agent: RunnerAgent, region: RegionSlug): AgentFeed[] {
  const configured = agent.feedsByRegion[region] ?? [];
  return dedupeFeeds(configured.filter((feed) => GOOGLE_NEWS_ENABLED || !isSupplementalFeed(feed)));
}

function parseNumberArg(name: string, fallback: number): number {
  const raw = process.argv
    .slice(2)
    .find((arg) => arg.startsWith(`--${name}=`))
    ?.split("=")[1];
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function parseNumberArgAliases(names: string[], fallback: number): number {
  for (const name of names) {
    const value = parseNumberArg(name, Number.NaN);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return fallback;
}

function readOptions(): AuditOptions {
  const minCoreFeedsDefault = Number(process.env.FEED_AUDIT_MIN_CORE_FEEDS ?? process.env.FEED_AUDIT_MIN_FEEDS ?? 5);
  const minCoreUsableDefault = Number(process.env.FEED_AUDIT_MIN_CORE_USABLE ?? process.env.FEED_AUDIT_MIN_USABLE ?? 4);
  return {
    minCoreFeeds: parseNumberArgAliases(["min-core-feeds", "min-feeds"], minCoreFeedsDefault),
    minCoreUsable: parseNumberArgAliases(["min-core-usable", "min-usable"], minCoreUsableDefault),
    timeoutMs: parseNumberArg("timeout-ms", Number(process.env.FEED_AUDIT_TIMEOUT_MS ?? 8_000)),
    concurrency: parseNumberArg("concurrency", Number(process.env.FEED_AUDIT_CONCURRENCY ?? 8)),
    maxFailureLines: parseNumberArg("max-failures", Number(process.env.FEED_AUDIT_MAX_FAILURES ?? 120))
  };
}

function countFeedItems(xml: string): number {
  const items = xml.match(/<item\b/gi)?.length ?? 0;
  const entries = xml.match(/<entry\b/gi)?.length ?? 0;
  return items + entries;
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

async function checkFeed(feed: AgentFeed, timeoutMs: number): Promise<FeedCheckResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(feed.url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ProofOfConceptStudioFeedAudit/1.0)",
        Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.9, */*;q=0.8"
      }
    });

    if (!response.ok) {
      return { ok: false, reason: `http ${response.status}` };
    }

    const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
    const text = (await response.text()).slice(0, 400_000);
    const xmlLike =
      feed.type === "rss" ||
      contentType.includes("xml") ||
      contentType.includes("rss") ||
      contentType.includes("atom");

    if (xmlLike) {
      const itemCount = countFeedItems(text);
      if (itemCount < 1) {
        return {
          ok: false,
          reason: "no rss/atom items",
          contentType,
          itemCount
        };
      }
      return { ok: true, contentType, itemCount };
    }

    const stripped = stripHtml(text);
    if (stripped.length < 200) {
      return {
        ok: false,
        reason: `web content too thin (${stripped.length} chars)`,
        contentType
      };
    }

    return { ok: true, contentType };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timeout);
  }
}

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];
  const results: R[] = new Array(items.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) break;
      results[index] = await worker(items[index]);
    }
  });

  await Promise.all(runners);
  return results;
}

async function main() {
  const options = readOptions();
  const agents = loadAgents().filter((agent) => agent.mode !== "market-dashboard");
  const regions: RegionSlug[] = ["au", "us-mx-la-lng"];
  const summaryRows: AgentRegionAudit[] = [];
  const failures: FailedFeed[] = [];
  const coverageIssues: string[] = [];

  for (const agent of agents) {
    for (const region of regions) {
      const feeds = getRuntimeFeeds(agent, region);
      const checks = await runWithConcurrency(feeds, options.concurrency, async (feed) => {
        const result = await checkFeed(feed, options.timeoutMs);
        return { feed, result, supplemental: isSupplementalFeed(feed) };
      });

      const usableFeeds = checks.filter((entry) => entry.result.ok).length;
      const failingFeeds = checks.length - usableFeeds;
      const coreChecks = checks.filter((entry) => !entry.supplemental);
      const supplementalChecks = checks.filter((entry) => entry.supplemental);
      const coreUsableFeeds = coreChecks.filter((entry) => entry.result.ok).length;
      const coreFailingFeeds = coreChecks.length - coreUsableFeeds;
      const supplementalUsableFeeds = supplementalChecks.filter((entry) => entry.result.ok).length;
      const supplementalFailingFeeds = supplementalChecks.length - supplementalUsableFeeds;

      for (const entry of checks) {
        if (entry.result.ok) continue;
        failures.push({
          agentId: agent.id,
          region,
          name: entry.feed.name,
          url: entry.feed.url,
          reason: entry.result.reason ?? "unknown error",
          supplemental: entry.supplemental
        });
      }

      summaryRows.push({
        agentId: agent.id,
        region,
        totalFeeds: feeds.length,
        usableFeeds,
        failingFeeds,
        coreFeeds: coreChecks.length,
        coreUsableFeeds,
        coreFailingFeeds,
        supplementalFeeds: supplementalChecks.length,
        supplementalUsableFeeds,
        supplementalFailingFeeds
      });

      if (coreChecks.length < options.minCoreFeeds) {
        coverageIssues.push(
          `${agent.id}/${region} has ${coreChecks.length} core feeds (minimum ${options.minCoreFeeds} required)`
        );
      }
      if (coreUsableFeeds < options.minCoreUsable) {
        coverageIssues.push(
          `${agent.id}/${region} has ${coreUsableFeeds} usable core feeds (minimum ${options.minCoreUsable} required)`
        );
      }
    }
  }

  const totalFeeds = summaryRows.reduce((sum, row) => sum + row.totalFeeds, 0);
  const totalUsable = summaryRows.reduce((sum, row) => sum + row.usableFeeds, 0);
  const totalFailing = summaryRows.reduce((sum, row) => sum + row.failingFeeds, 0);
  const totalCoreFeeds = summaryRows.reduce((sum, row) => sum + row.coreFeeds, 0);
  const totalCoreUsable = summaryRows.reduce((sum, row) => sum + row.coreUsableFeeds, 0);
  const totalCoreFailing = summaryRows.reduce((sum, row) => sum + row.coreFailingFeeds, 0);
  const totalSupplementalFeeds = summaryRows.reduce((sum, row) => sum + row.supplementalFeeds, 0);
  const totalSupplementalFailing = summaryRows.reduce((sum, row) => sum + row.supplementalFailingFeeds, 0);

  console.log("Feed Audit Summary");
  console.log("==================");
  console.log(`Agent regions checked: ${summaryRows.length}`);
  console.log(`Total feeds checked: ${totalFeeds}`);
  console.log(`Usable feeds: ${totalUsable}`);
  console.log(`Failing feeds: ${totalFailing}`);
  console.log(`Core feeds: ${totalCoreFeeds} (usable=${totalCoreUsable}, failing=${totalCoreFailing})`);
  console.log(`Supplemental feeds: ${totalSupplementalFeeds} (failing=${totalSupplementalFailing})`);
  console.log("");
  console.log("Per Agent/Region");
  console.log("----------------");
  for (const row of summaryRows) {
    console.log(
      `${row.agentId.padEnd(38)} ${row.region.padEnd(13)} total=${String(row.totalFeeds).padStart(2)} usable=${String(
        row.usableFeeds
      ).padStart(2)} failing=${String(row.failingFeeds).padStart(2)} core=${String(row.coreUsableFeeds).padStart(2)}/${String(
        row.coreFeeds
      ).padStart(2)} supplementalFailing=${String(row.supplementalFailingFeeds).padStart(2)}`
    );
  }

  if (failures.length > 0) {
    console.log("");
    console.log(`Failing feeds (showing up to ${options.maxFailureLines})`);
    console.log("-----------------------------------------");
    for (const failure of failures.slice(0, options.maxFailureLines)) {
      console.log(
        `[${failure.agentId}/${failure.region}] ${failure.name} :: ${failure.reason} :: ${failure.url} :: ${
          failure.supplemental ? "supplemental" : "core"
        }`
      );
    }
  }

  if (coverageIssues.length > 0) {
    console.error("");
    console.error("Coverage thresholds not met:");
    for (const issue of coverageIssues) {
      console.error(`- ${issue}`);
    }
    process.exit(1);
  }

  console.log("");
  console.log("Coverage thresholds passed.");
}

main().catch((error) => {
  console.error("Feed audit failed:", error);
  process.exit(1);
});
