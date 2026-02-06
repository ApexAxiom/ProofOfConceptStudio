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
}

interface FailedFeed {
  agentId: string;
  region: RegionSlug;
  name: string;
  url: string;
  reason: string;
}

interface AuditOptions {
  minFeeds: number;
  minUsable: number;
  timeoutMs: number;
  concurrency: number;
  maxFailureLines: number;
}

function parseNumberArg(name: string, fallback: number): number {
  const raw = process.argv
    .slice(2)
    .find((arg) => arg.startsWith(`--${name}=`))
    ?.split("=")[1];
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function readOptions(): AuditOptions {
  return {
    minFeeds: parseNumberArg("min-feeds", Number(process.env.FEED_AUDIT_MIN_FEEDS ?? 10)),
    minUsable: parseNumberArg("min-usable", Number(process.env.FEED_AUDIT_MIN_USABLE ?? 8)),
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
      const feeds = agent.feedsByRegion[region] ?? [];
      const checks = await runWithConcurrency(feeds, options.concurrency, async (feed) => {
        const result = await checkFeed(feed, options.timeoutMs);
        return { feed, result };
      });

      const usableFeeds = checks.filter((entry) => entry.result.ok).length;
      const failingFeeds = checks.length - usableFeeds;

      for (const entry of checks) {
        if (entry.result.ok) continue;
        failures.push({
          agentId: agent.id,
          region,
          name: entry.feed.name,
          url: entry.feed.url,
          reason: entry.result.reason ?? "unknown error"
        });
      }

      summaryRows.push({
        agentId: agent.id,
        region,
        totalFeeds: feeds.length,
        usableFeeds,
        failingFeeds
      });

      if (feeds.length < options.minFeeds) {
        coverageIssues.push(
          `${agent.id}/${region} has ${feeds.length} feeds (minimum ${options.minFeeds} required)`
        );
      }
      if (usableFeeds < options.minUsable) {
        coverageIssues.push(
          `${agent.id}/${region} has ${usableFeeds} usable feeds (minimum ${options.minUsable} required)`
        );
      }
    }
  }

  const totalFeeds = summaryRows.reduce((sum, row) => sum + row.totalFeeds, 0);
  const totalUsable = summaryRows.reduce((sum, row) => sum + row.usableFeeds, 0);
  const totalFailing = summaryRows.reduce((sum, row) => sum + row.failingFeeds, 0);

  console.log("Feed Audit Summary");
  console.log("==================");
  console.log(`Agent regions checked: ${summaryRows.length}`);
  console.log(`Total feeds checked: ${totalFeeds}`);
  console.log(`Usable feeds: ${totalUsable}`);
  console.log(`Failing feeds: ${totalFailing}`);
  console.log("");
  console.log("Per Agent/Region");
  console.log("----------------");
  for (const row of summaryRows) {
    console.log(
      `${row.agentId.padEnd(38)} ${row.region.padEnd(13)} feeds=${String(row.totalFeeds).padStart(2)} usable=${String(
        row.usableFeeds
      ).padStart(2)} failing=${String(row.failingFeeds).padStart(2)}`
    );
  }

  if (failures.length > 0) {
    console.log("");
    console.log(`Failing feeds (showing up to ${options.maxFailureLines})`);
    console.log("-----------------------------------------");
    for (const failure of failures.slice(0, options.maxFailureLines)) {
      console.log(
        `[${failure.agentId}/${failure.region}] ${failure.name} :: ${failure.reason} :: ${failure.url}`
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
