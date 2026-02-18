import {
  BriefPost,
  BriefV2NewsStatus,
  REGIONS,
  RegionSlug,
  RunWindow,
  BriefRunIdentity,
  BriefRunMetrics,
  buildBriefPostId,
  buildBriefRunKey,
  getBriefDayKey,
  indicesForRegion,
  makeCategoryPlaceholderDataUrl,
  runWindowForRegion,
  validateBriefV2Record
} from "@proof/shared";
import type { BriefV2HeroImage } from "@proof/shared";
import { expandAgentsByRegion, loadAgents } from "./agents/config.js";
import { auditCoverage } from "./brief-coverage/audit.js";
import { expectedCoverageDayKey } from "./brief-coverage/day.js";
import { PlaceholderReason } from "./brief-coverage/placeholders.js";
import { resolveFallbackBrief } from "./brief-coverage/fallback.js";
import { fetchGeneralContextArticles, ingestAgent, ArticleDetail, IngestResult } from "./ingest/fetch.js";
import { generateBrief } from "./llm/openai.js";
import type { ArticleInput } from "./llm/openai.js";
import { validateBrief } from "./publish/validate.js";
import { validateNumericClaims } from "./publish/factuality.js";
import { attachEvidenceToBrief } from "./publish/evidence.js";
import { publishBrief, logBriefRunResult, logBriefRunStart, logRunResult } from "./publish/dynamo.js";
import crypto from "node:crypto";
import { runMarketDashboard } from "./market/dashboard.js";
import { getLatestPublishedBrief } from "./db/previous-brief.js";
import { fetchPortfolioSnapshot } from "./market/portfolio-snapshot.js";
import { buildContextNote, buildTopStories, deriveDeltaSinceLastRun, normalizeNewsStatus } from "./brief-v2.js";
import { cacheHeroImageToS3 } from "./media/cache-hero-image.js";
import { emitRunnerMetrics } from "./observability/metrics.js";

type RunStatus = "published" | "no-updates" | "failed" | "dry-run";
type RunResult = { agentId: string; region: RegionSlug; ok: boolean; status: RunStatus; error?: string };

/**
 * Runs tasks with concurrency limit
 */
async function runWithLimit<T>(tasks: (() => Promise<T>)[], limit = 3): Promise<T[]> {
  const results: T[] = [];
  let index = 0;
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, async () => {
    while (index < tasks.length) {
      const current = tasks[index++];
      results.push(await current());
    }
  });
  await Promise.all(workers);
  return results;
}

async function runWithTimeout<T>(task: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timed out: ${label}`)), timeoutMs);
  });
  try {
    return await Promise.race([task, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function publishFallbackBrief(options: {
  agent: ReturnType<typeof loadAgents>[number];
  region: RegionSlug;
  runWindow: RunWindow;
  runId: string;
  reason: PlaceholderReason;
  previousBrief?: BriefPost | null;
  ingestResult?: IngestResult;
  now?: Date;
  runIdentity?: BriefRunIdentity;
  dryRun?: boolean;
}): Promise<RunResult> {
  const ingestResult: IngestResult =
    options.ingestResult ?? {
      articles: [],
      scannedSources: [],
      metrics: { collectedCount: 0, dedupedCount: 0, extractedCount: 0 }
    };
  const dryRun = options.dryRun ?? false;

  const brief = resolveFallbackBrief({
    agent: options.agent,
    region: options.region,
    runWindow: options.runWindow,
    reason: options.reason,
    previousBrief: options.previousBrief,
    now: options.now
  });
  if (!brief) {
    const status: RunStatus = dryRun ? "dry-run" : options.reason === "no-updates" ? "no-updates" : "failed";
    const error = "placeholder_suppressed_in_production";
    console.warn(
      JSON.stringify({
        level: "warn",
        event: "fallback_publish_suppressed",
        reasonCode: "placeholder_suppressed",
        runId: options.runId,
        agentId: options.agent.id,
        region: options.region,
        portfolio: options.agent.portfolio,
        runWindow: options.runWindow,
        runDate: (options.now ?? new Date()).toISOString(),
        reason: options.reason
      })
    );
    await logRunResult(options.runId, options.agent.id, options.region, status, status === "failed" ? error : undefined);
    if (options.runIdentity) {
      await logBriefRunResult({
        identity: options.runIdentity,
        runId: options.runId,
        status: status === "failed" ? "failed" : status === "no-updates" ? "no-updates" : "dry-run",
        finishedAt: new Date().toISOString(),
        error: status === "failed" ? error : undefined,
        dryRun
      });
    }
    return { agentId: options.agent.id, region: options.region, ok: status !== "failed", status, error };
  }
  const normalizedBrief = options.runIdentity
    ? {
        ...brief,
        postId: buildBriefPostId(options.runIdentity),
        runKey: buildBriefRunKey(options.runIdentity),
        briefDay: options.runIdentity.briefDay
      }
    : brief;

  try {
    const status: RunStatus = dryRun ? "dry-run" : options.reason === "no-updates" ? "no-updates" : "published";
    if (!dryRun) {
      await publishBrief(normalizedBrief, ingestResult, options.runId);
    }
    await logRunResult(options.runId, options.agent.id, options.region, status);
    if (options.runIdentity) {
      await logBriefRunResult({
        identity: options.runIdentity,
        runId: options.runId,
        status: status === "published" ? "succeeded" : status === "no-updates" ? "no-updates" : "dry-run",
        finishedAt: new Date().toISOString(),
        metrics: {
          sourcesFetched: ingestResult.scannedSources?.length ?? 0,
          itemsCollected: ingestResult.metrics?.collectedCount ?? 0,
          itemsDeduped: ingestResult.metrics?.dedupedCount ?? 0,
          itemsExtracted: ingestResult.metrics?.extractedCount ?? 0,
          itemsSelected: normalizedBrief.selectedArticles?.length ?? 0,
          briefLength: normalizedBrief.bodyMarkdown?.length ?? 0
        },
        dryRun
      });
    }
    return { agentId: options.agent.id, region: options.region, ok: true, status };
  } catch (error) {
    const message = (error as Error).message;
    await logRunResult(options.runId, options.agent.id, options.region, "failed", message);
    if (options.runIdentity) {
      await logBriefRunResult({
        identity: options.runIdentity,
        runId: options.runId,
        status: "failed",
        finishedAt: new Date().toISOString(),
        error: message,
        dryRun
      });
    }
    return { agentId: options.agent.id, region: options.region, ok: false, status: "failed", error: message };
  }
}

function dayKeyToMiddayUtc(dayKey: string): Date {
  return new Date(`${dayKey}T12:00:00.000Z`);
}

async function getLatestRealBriefSafe(params: {
  portfolio: string;
  region: RegionSlug;
  beforeIso: string;
  runId: string;
  runWindow: RunWindow;
  runDate: string;
  agentId: string;
}): Promise<BriefPost | null> {
  try {
    return await getLatestPublishedBrief({
      portfolio: params.portfolio,
      region: params.region,
      beforeIso: params.beforeIso
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "previous_brief_read_failed",
        reasonCode: "dynamo_read_failed",
        runId: params.runId,
        agentId: params.agentId,
        portfolio: params.portfolio,
        region: params.region,
        runWindow: params.runWindow,
        runDate: params.runDate,
        error: (error as Error).message
      })
    );
    return null;
  }
}

async function backfillMissedDay(options: {
  regions: RegionSlug[];
  runId: string;
  agentIds?: string[];
}): Promise<void> {
  const emptyIngest = {
    articles: [],
    scannedSources: [],
    metrics: { collectedCount: 0, dedupedCount: 0, extractedCount: 0 }
  };
  const agents = loadAgents();

  for (const region of options.regions) {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const previousDayKey = getBriefDayKey(region, yesterday);
    const coverage = await auditCoverage({
      regions: [region],
      dayKey: previousDayKey,
      agentIds: options.agentIds
    });

    if (coverage.missingAgents.length === 0) continue;
    const targetDate = dayKeyToMiddayUtc(previousDayKey);
    let publishedFallbacks = 0;
    let suppressedFallbacks = 0;

    for (const missing of coverage.missingAgents) {
      const agent = agents.find((candidate) => candidate.id === missing.agentId);
      if (!agent) continue;
      const previousBrief = await getLatestRealBriefSafe({
        portfolio: agent.portfolio,
        region: missing.region,
        beforeIso: targetDate.toISOString(),
        runId: options.runId,
        runWindow: runWindowForRegion(missing.region),
        runDate: targetDate.toISOString(),
        agentId: agent.id
      });
      const runIdentity: BriefRunIdentity = {
        briefDay: previousDayKey,
        region: missing.region,
        portfolio: agent.portfolio,
        runWindow: runWindowForRegion(missing.region)
      };

      const result = await publishFallbackBrief({
        agent,
        region: missing.region,
        runWindow: runWindowForRegion(missing.region),
        runId: options.runId,
        reason: "no-updates",
        previousBrief,
        ingestResult: emptyIngest,
        now: targetDate,
        runIdentity
      });
      if (result.status === "published") publishedFallbacks += 1;
      if (result.error === "placeholder_suppressed_in_production") suppressedFallbacks += 1;
    }

    console.warn(
      JSON.stringify({
        level: "warn",
        event: publishedFallbacks > 0 ? "coverage_backfill_published" : "coverage_backfill_skipped",
        reasonCode: publishedFallbacks > 0 ? "fallback_published" : "placeholder_suppressed",
        runId: options.runId,
        region,
        dayKey: previousDayKey,
        runDate: targetDate.toISOString(),
        runWindow: runWindowForRegion(region),
        missingCount: coverage.missingAgents.length,
        publishedFallbacks,
        suppressedFallbacks
      })
    );
  }
}

async function publishPlaceholder({
  agentId,
  region,
  runWindow,
  runId,
  reason,
  dryRun,
  runDate
}: {
  agentId: string;
  region: RegionSlug;
  runWindow: RunWindow;
  runId: string;
  reason: PlaceholderReason;
  dryRun?: boolean;
  runDate?: string;
}): Promise<RunResult> {
  const agents = loadAgents();
  const agent = agents.find((a) => a.id === agentId);
  if (!agent) {
    const error = `Agent ${agentId} not found for placeholder`;
    console.error(
      JSON.stringify({
        level: "error",
        event: "fallback_agent_not_found",
        reasonCode: "agent_not_found",
        runId,
        agentId,
        region,
        runWindow,
        runDate: runDate ?? new Date().toISOString(),
        error
      })
    );
    await logRunResult(runId, agentId, region, "failed", error);
    return { agentId, region, ok: false, status: "failed", error };
  }

  const runNow = runDate ? new Date(runDate) : new Date();
  const previousBrief = await getLatestRealBriefSafe({
    portfolio: agent.portfolio,
    region,
    beforeIso: runNow.toISOString(),
    runId,
    runWindow,
    runDate: runNow.toISOString(),
    agentId: agent.id
  });
  const briefDay = getBriefDayKey(region, runNow);
  const runIdentity: BriefRunIdentity = {
    briefDay,
    region,
    portfolio: agent.portfolio,
    runWindow
  };
  const fallback = await publishFallbackBrief({
    agent,
    region,
    runWindow,
    runId,
    reason,
    previousBrief,
    ingestResult: { articles: [], scannedSources: [], metrics: { collectedCount: 0, dedupedCount: 0, extractedCount: 0 } },
    runIdentity,
    dryRun,
    now: runNow
  });
  if (!fallback.ok) {
    console.error(`[${agentId}/${region}] Fallback publish failed`, fallback.error);
  }
  return fallback;
}

type ArticleSource = Omit<ArticleDetail, "contentStatus"> & {
  contentStatus?: string;
};

const normalizeContentStatus = (status?: string): ArticleInput["contentStatus"] =>
  status === "ok" || status === "thin" ? status : undefined;

/**
 * Converts ArticleDetail to ArticleInput for the LLM
 */
function toArticleInput(article: ArticleSource): ArticleInput {
  return {
    title: article.title,
    url: article.url,
    content: article.content,
    ogImageUrl: article.ogImageUrl,
    sourceName: article.sourceName,
    publishedAt: article.published,
    contentStatus: normalizeContentStatus(article.contentStatus)
  };
}

function isUsableCategoryArticle(article: ArticleInput): boolean {
  const contentLength = (article.content ?? "").trim().length;
  return contentLength >= 300 && article.contentStatus !== "thin";
}

function isThinCategoryDay(articles: ArticleInput[]): boolean {
  if (articles.length < 2) return true;
  const usableCount = articles.filter(isUsableCategoryArticle).length;
  const allThinOrEmpty = articles.every((article) => {
    const contentLength = (article.content ?? "").trim().length;
    return article.contentStatus === "thin" || contentLength === 0;
  });
  return usableCount < 2 || allThinOrEmpty;
}

function mergeArticleInputs(primary: ArticleInput[], supplemental: ArticleInput[]): ArticleInput[] {
  const seen = new Set<string>();
  const merged: ArticleInput[] = [];
  for (const article of [...primary, ...supplemental]) {
    const key = article.url.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(article);
  }
  return merged;
}

function heroBucketConfig() {
  const bucket = process.env.BRIEF_IMAGE_S3_BUCKET?.trim();
  const bucketRegion = process.env.BRIEF_IMAGE_S3_REGION?.trim() || process.env.AWS_REGION?.trim();
  const publicBaseUrl = process.env.BRIEF_IMAGE_PUBLIC_BASE_URL?.trim();
  if (!bucket || !bucketRegion || !publicBaseUrl) return null;
  return { bucket, bucketRegion, publicBaseUrl };
}

async function resolveHeroImage(params: {
  brief: BriefPost;
  categorySlug: string;
  categoryLabel: string;
  region: RegionSlug;
  publishedAt: string;
}): Promise<{ heroImage: BriefV2HeroImage; heroSourceUrl?: string }> {
  const selectedArticles = params.brief.selectedArticles ?? [];
  const heroBySourceUrl = selectedArticles.find(
    (article) => article.url === params.brief.heroImageSourceUrl && article.imageUrl
  );
  const firstWithImage = selectedArticles.find((article) => article.imageUrl);
  const fallbackSource = selectedArticles.find((article) => article.url === params.brief.heroImageSourceUrl) ?? selectedArticles[0];
  const heroCandidate = heroBySourceUrl ?? firstWithImage ?? fallbackSource;

  const sourceArticleIndex = heroCandidate?.sourceIndex ?? 1;
  const alt =
    params.brief.heroImageAlt?.trim() ||
    heroCandidate?.imageAlt?.trim() ||
    heroCandidate?.title?.trim() ||
    params.brief.title;

  const cacheConfig = heroBucketConfig();
  let cachedHero: { url: string; cacheKey: string; contentType: string } | null = null;

  if (cacheConfig && heroCandidate?.imageUrl) {
    cachedHero = await cacheHeroImageToS3({
      ogImageUrl: heroCandidate.imageUrl,
      categorySlug: params.categorySlug,
      region: params.region,
      publishedDateISO: params.publishedAt,
      articleIndex: sourceArticleIndex,
      bucket: cacheConfig.bucket,
      bucketRegion: cacheConfig.bucketRegion,
      publicBaseUrl: cacheConfig.publicBaseUrl
    });
  }

  const heroUrl = cachedHero?.url ?? makeCategoryPlaceholderDataUrl(params.categoryLabel);

  return {
    heroImage: {
      url: heroUrl,
      alt,
      sourceArticleIndex,
      cacheKey: cachedHero?.cacheKey
    },
    heroSourceUrl: heroCandidate?.url
  };
}

/**
 * Main cron handler - runs all agents for the specified run window
 */
export async function handleCron(
  runWindow: RunWindow,
  opts?: {
    runId?: string;
    scheduled?: boolean;
    regions?: RegionSlug[];
    agentIds?: string[];
    dryRun?: boolean;
    runDate?: string;
  }
) {
  const agents = loadAgents();
  const normalAgents = agents.filter((a) => a.mode !== "market-dashboard");
  const dashboardAgents = agents.filter((a) => a.mode === "market-dashboard");
  const agentFilter = opts?.agentIds?.length ? new Set(opts.agentIds) : null;
  const filteredNormalAgents = agentFilter
    ? normalAgents.filter((agent) => agentFilter.has(agent.id))
    : normalAgents;
  const filteredDashboardAgents = agentFilter
    ? dashboardAgents.filter((agent) => agentFilter.has(agent.id))
    : dashboardAgents;
  const runId = opts?.runId ?? crypto.randomUUID();
  const tasks: (() => Promise<RunResult>)[] = [];
  const regionFilter = opts?.regions ? new Set(opts.regions) : null;

  const regionList = regionFilter ? Array.from(regionFilter) : undefined;
  const targetedAgents = expandAgentsByRegion({ agents: filteredNormalAgents, regions: regionList });

  for (const { agent, region } of targetedAgents) {
    tasks.push(() => runAgent(agent.id, region, runWindow, { runId, dryRun: opts?.dryRun, runDate: opts?.runDate }));
  }

  // Run briefs with concurrency limit of 2 to prevent overload
  const results = await runWithLimit(tasks, 2);

  // Run market dashboard agents after normal briefs are published
  const dashboardTargets = expandAgentsByRegion({ agents: filteredDashboardAgents, regions: regionList });
  for (const { agent, region } of dashboardTargets) {
    const dashboardResult = await runMarketDashboard(agent, region, runWindow, runId, {
      dryRun: opts?.dryRun,
      runDate: opts?.runDate
    });
    results.push(dashboardResult);
  }

  const summary = results.reduce(
    (acc, r) => {
      if (r.status === "published") acc.published += 1;
      else if (r.status === "dry-run") acc.dryRun += 1;
      else if (r.status === "no-updates") acc.noUpdates += 1;
      else acc.failed += 1;
      return acc;
    },
    { published: 0, noUpdates: 0, failed: 0, dryRun: 0 }
  );

  const allRegions = Object.keys(REGIONS) as RegionSlug[];
  const auditRegions = regionList ?? allRegions;
  const coverageAgentIds = opts?.agentIds;
  const coverageDayByRegion = new Map(auditRegions.map((region) => [region, expectedCoverageDayKey(region, new Date())]));
  const coverageResults = await Promise.all(
    auditRegions.map((region) =>
      auditCoverage({
        regions: [region],
        dayKey: coverageDayByRegion.get(region) ?? expectedCoverageDayKey(region, new Date()),
        agentIds: coverageAgentIds
      })
    )
  );

  const missingByRegion = coverageResults.flatMap((coverage) => coverage.missingAgents);
  const missingCount = missingByRegion.length;
  let finalMissingByRegion = missingByRegion;
  const retryResults: RunResult[] = [];

  if (missingCount > 0) {
    console.warn(
      JSON.stringify({
        level: "warn",
        event: "coverage_missing",
        reasonCode: "coverage_gap",
        runId,
        regions: auditRegions,
        runWindow,
        runDate: opts?.runDate ?? new Date().toISOString(),
        missingCount,
        missingAgentIds: missingByRegion.map((m) => m.agentId)
      })
    );

    const rerunTasks = missingByRegion.map((missing) => () =>
      runWithTimeout(
        runAgent(missing.agentId, missing.region, runWindowForRegion(missing.region), {
          runId,
          dryRun: opts?.dryRun,
          runDate: opts?.runDate
        }),
        10 * 60 * 1000,
        `rerun-${missing.agentId}`
      )
        .catch((error): RunResult => ({
          agentId: missing.agentId,
          region: missing.region,
          ok: false,
          status: "failed",
          error: (error as Error).message
        }))
    );

    const rerunResults = await runWithLimit(rerunTasks, 2);
    retryResults.push(...rerunResults);
    const rerunCoverageResults = await Promise.all(
      auditRegions.map((region) =>
        auditCoverage({
          regions: [region],
          dayKey: coverageDayByRegion.get(region) ?? expectedCoverageDayKey(region, new Date()),
          agentIds: coverageAgentIds
        })
      )
    );
    const stillMissing = rerunCoverageResults.flatMap((coverage) => coverage.missingAgents);
    finalMissingByRegion = stillMissing;
    if (stillMissing.length > 0) {
      const placeholderTasks = stillMissing.map((missing) => {
        const priorResult = rerunResults.find((result) => result.agentId === missing.agentId && result.region === missing.region);
        const reason: PlaceholderReason = priorResult?.status === "no-updates" ? "no-updates" : "generation-failed";
        return () =>
          publishPlaceholder({
            agentId: missing.agentId,
            region: missing.region,
            runWindow: runWindowForRegion(missing.region),
            runId,
            reason,
            dryRun: opts?.dryRun,
            runDate: opts?.runDate
          });
      });
      const placeholderResults = await runWithLimit(placeholderTasks, 2);
      retryResults.push(...placeholderResults);
      const publishedFallbacks = placeholderResults.filter((result) => result.status === "published").length;
      const suppressedCount = placeholderResults.filter((result) => result.error === "placeholder_suppressed_in_production").length;
      console.warn(
        JSON.stringify({
          level: publishedFallbacks > 0 ? "warn" : "error",
          event: publishedFallbacks > 0 ? "coverage_placeholder_published" : "coverage_gap_unresolved",
          reasonCode: publishedFallbacks > 0 ? "fallback_published" : "placeholder_suppressed",
          runId,
          regions: auditRegions,
          missingAgentIds: stillMissing.map((m) => m.agentId),
          runWindow,
          runDate: opts?.runDate ?? new Date().toISOString(),
          publishedFallbacks,
          suppressedCount
        })
      );
    }

    const finalCoverageResults = await Promise.all(
      auditRegions.map((region) =>
        auditCoverage({
          regions: [region],
          dayKey: coverageDayByRegion.get(region) ?? expectedCoverageDayKey(region, new Date()),
          agentIds: coverageAgentIds
        })
      )
    );
    finalMissingByRegion = finalCoverageResults.flatMap((coverage) => coverage.missingAgents);
  } else {
    console.log(
      JSON.stringify({
        level: "info",
        event: "coverage_ok",
        runId,
        regions: auditRegions,
        runWindow,
        runDate: opts?.runDate ?? new Date().toISOString(),
        expectedCount: coverageResults.reduce((total, coverage) => total + coverage.expectedAgents.length, 0),
        writtenCount: coverageResults.reduce((total, coverage) => total + coverage.publishedBriefs.length, 0),
        missingCount: 0
      })
    );
  }

  try {
    await backfillMissedDay({
      regions: auditRegions,
      runId,
      agentIds: coverageAgentIds
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "coverage_backfill_failed",
        reasonCode: "coverage_backfill_failed",
        runId,
        runWindow,
        runDate: opts?.runDate ?? new Date().toISOString(),
        error: (error as Error).message
      })
    );
  }

  const allResults = [...results, ...retryResults];
  const regionsForMetrics = auditRegions;
  for (const region of regionsForMetrics) {
    const regionResults = allResults.filter((result) => result.region === region);
    const regionMissingCount = finalMissingByRegion.filter((missing) => missing.region === region).length;
    const regionPublished = regionResults.filter((result) => result.status === "published").length;
    const regionFailed = regionResults.filter((result) => result.status === "failed").length;
    const regionNoUpdates = regionResults.filter((result) => result.status === "no-updates").length;
    const regionDryRun = regionResults.filter((result) => result.status === "dry-run").length;

    emitRunnerMetrics({
      dimensions: {
        Region: region
      },
      metrics: [
        { name: "RunCompleted", value: 1, unit: "Count" },
        { name: "PublishedBriefs", value: regionPublished, unit: "Count" },
        { name: "FailedBriefs", value: regionFailed, unit: "Count" },
        { name: "NoUpdateBriefs", value: regionNoUpdates, unit: "Count" },
        { name: "DryRunBriefs", value: regionDryRun, unit: "Count" },
        { name: "CoverageMissingCount", value: regionMissingCount, unit: "Count" }
      ],
      properties: {
        event: "cron_region_summary",
        runId,
        runWindow,
        runDate: opts?.runDate ?? new Date().toISOString(),
        scheduled: opts?.scheduled === true
      }
    });
  }

  return {
    runId,
    ok: summary.failed === 0,
    ...summary,
    missingCount,
    missingAgentIds: missingByRegion.map((missing) => missing.agentId)
  };
}

/**
 * Runs a single agent for a specific region
 */
export async function runAgent(
  agentId: string,
  region: RegionSlug,
  runWindow: RunWindow,
  options?: { runId?: string; dryRun?: boolean; runDate?: string }
): Promise<RunResult> {
  const agents = loadAgents();
  const agent = agents.find((a) => a.id === agentId);
  
  if (!agent) {
    const error = `Agent ${agentId} not found`;
    console.error(
      JSON.stringify({
        level: "error",
        event: "run_agent_not_found",
        reasonCode: "agent_not_found",
        runId: options?.runId,
        agentId,
        region,
        runWindow,
        runDate: options?.runDate ?? new Date().toISOString(),
        error
      })
    );
    await logRunResult(options?.runId ?? crypto.randomUUID(), agentId, region, "failed", error);
    return { agentId, region, ok: false, status: "failed", error };
  }

  const feeds = agent.feedsByRegion[region];
  if (!feeds || feeds.length === 0) {
    const error = `Region ${region} is not configured for agent ${agentId}`;
    console.error(
      JSON.stringify({
        level: "error",
        event: "run_region_not_configured",
        reasonCode: "missing_region_config",
        runId: options?.runId,
        agentId,
        portfolio: agent.portfolio,
        region,
        runWindow,
        runDate: options?.runDate ?? new Date().toISOString(),
        error
      })
    );
    await logRunResult(options?.runId ?? crypto.randomUUID(), agentId, region, "failed", error);
    return { agentId, region, ok: false, status: "failed", error };
  }

  const runIdentifier = options?.runId ?? crypto.randomUUID();
  const dryRun = options?.dryRun ?? false;
  const now = options?.runDate ? new Date(options.runDate) : new Date();
  if (Number.isNaN(now.getTime())) {
    throw new Error(`Invalid runDate provided: ${options?.runDate}`);
  }
  const briefDay = getBriefDayKey(region, now);
  const runIdentity: BriefRunIdentity = {
    briefDay,
    region,
    portfolio: agent?.portfolio ?? "unknown",
    runWindow
  };
  const runKey = buildBriefRunKey(runIdentity);
  const postId = buildBriefPostId(runIdentity);
  await logBriefRunStart(runIdentity, runIdentifier, now.toISOString(), dryRun);
  const emptyIngestResult = {
    articles: [],
    scannedSources: [],
    metrics: { collectedCount: 0, dedupedCount: 0, extractedCount: 0 }
  };
  let ingestSummary = {
    scannedSourcesCount: 0,
    metrics: emptyIngestResult.metrics
  };
  const buildMetrics = (params: {
    selectedCount: number;
    briefLength: number;
    usage?: BriefPost["llmUsage"];
  }): BriefRunMetrics => ({
    sourcesFetched: ingestSummary.scannedSourcesCount,
    itemsCollected: ingestSummary.metrics.collectedCount ?? 0,
    itemsDeduped: ingestSummary.metrics.dedupedCount ?? 0,
    itemsExtracted: ingestSummary.metrics.extractedCount ?? 0,
    itemsSelected: params.selectedCount,
    briefLength: params.briefLength,
    promptTokens: params.usage?.promptTokens,
    completionTokens: params.usage?.completionTokens,
    totalTokens: params.usage?.totalTokens
  });

  try {
    // Step 1: Ingest articles from all feeds
    console.log(`[${agentId}/${region}] Ingesting articles...`);
    let ingestResult;
    try {
      ingestResult = await ingestAgent(agent, region, {
        runWindow,
        runDate: now.toISOString()
      });
    } catch (ingestErr) {
      console.error(`[${agentId}/${region}] Ingestion failed:`, ingestErr);
      const error = `Ingestion error: ${(ingestErr as Error).message}`;
      console.error(
        JSON.stringify({
          level: "error",
          event: "run_ingest_failed",
          reasonCode: "ingest_failed",
          runId: runIdentifier,
          agentId: agent.id,
          portfolio: agent.portfolio,
          region,
          runWindow,
          runDate: now.toISOString(),
          error
        })
      );
      const previousBrief = await getLatestRealBriefSafe({
        portfolio: agent.portfolio,
        region,
        beforeIso: now.toISOString(),
        runId: runIdentifier,
        runWindow,
        runDate: now.toISOString(),
        agentId: agent.id
      });
      const fallback = await publishFallbackBrief({
        agent,
        region,
        runWindow,
        runId: runIdentifier,
        reason: "generation-failed",
        previousBrief,
        ingestResult: emptyIngestResult,
        runIdentity,
        dryRun,
        now
      });
      if (fallback.ok) return fallback;
      await logRunResult(runIdentifier, agent.id, region, "failed", error);
      return { agentId: agent.id, region, ok: false, status: "failed", error };
    }
    
    const articles: ArticleSource[] = ingestResult.articles ?? [];
    ingestSummary = {
      scannedSourcesCount: ingestResult.scannedSources?.length ?? 0,
      metrics: ingestResult.metrics ?? emptyIngestResult.metrics
    };
    
    // Minimum articles required - at least 1, but preferably the configured amount
    const minRequired = Math.max(1, Math.min(agent.articlesPerRun ?? 3, 2));
    
    if (articles.length === 0) {
      const error = `No articles found after ingestion (scanned ${ingestResult.scannedSources?.length ?? 0} sources)`;
      console.error(`[${agentId}/${region}] ${error}`);
      console.warn(
        JSON.stringify({
          level: "warn",
          event: "run_no_items",
          reasonCode: "zero_items",
          runId: runIdentifier,
          agentId: agent.id,
          portfolio: agent.portfolio,
          region,
          runWindow,
          runDate: now.toISOString(),
          scannedSources: ingestResult.scannedSources?.length ?? 0
        })
      );
      const previousBrief = await getLatestRealBriefSafe({
        portfolio: agent.portfolio,
        region,
        beforeIso: now.toISOString(),
        runId: runIdentifier,
        runWindow,
        runDate: now.toISOString(),
        agentId: agent.id
      });
      const fallback = await publishFallbackBrief({
        agent,
        region,
        runWindow,
        runId: runIdentifier,
        reason: "no-updates",
        previousBrief,
        ingestResult,
        runIdentity,
        dryRun,
        now
      });
      if (fallback.ok) return { ...fallback, error };
      await logRunResult(runIdentifier, agent.id, region, "failed", error);
      return { agentId: agent.id, region, ok: false, status: "failed", error };
    }
    
    if (articles.length < minRequired) {
      console.warn(`[${agentId}/${region}] Only ${articles.length} articles found (wanted ${minRequired}), proceeding anyway...`);
    }
    
    console.log(`[${agentId}/${region}] Found ${articles.length} articles (metrics: ${JSON.stringify(ingestResult.metrics)})`);
    console.log(
      JSON.stringify({
        level: "info",
        event: "ingest_complete",
        runId: runIdentifier,
        agentId: agent.id,
        portfolio: agent.portfolio,
        region,
        runWindow,
        runDate: now.toISOString(),
        metrics: ingestResult.metrics,
        scannedSourcesCount: ingestResult.scannedSources?.length ?? 0
      })
    );
    
    // Step 2: Get market indices for this region/portfolio
    const indices = indicesForRegion(agent.portfolio, region);

    // Step 3: Look up previous brief for delta context
    const previousBrief = await getLatestRealBriefSafe({
      portfolio: agent.portfolio,
      region,
      beforeIso: now.toISOString(),
      runId: runIdentifier,
      runWindow,
      runDate: now.toISOString(),
      agentId: agent.id
    });

    const previousBriefPrompt = previousBrief
      ? {
          publishedAt: previousBrief.publishedAt,
          title: previousBrief.title,
          highlights: previousBrief.highlights?.slice(0, 5),
          procurementActions: previousBrief.procurementActions?.slice(0, 5),
          watchlist: previousBrief.watchlist?.slice(0, 5),
          selectedArticles: previousBrief.selectedArticles?.slice(0, 3).map((article) => ({
            title: article.title,
            url: article.url,
            keyMetrics: article.keyMetrics?.slice(0, 3)
          }))
        }
      : undefined;

    // Step 4: Convert articles to LLM input format
    const baseArticleInputs: ArticleInput[] = articles.map(toArticleInput);
    const thinCategoryDetected = isThinCategoryDay(baseArticleInputs);
    let newsStatus: BriefV2NewsStatus = thinCategoryDetected ? "thin-category" : "ok";

    let articleInputs = baseArticleInputs;
    if (thinCategoryDetected) {
      console.warn(`[${agentId}/${region}] Thin category input detected, supplementing with broader O&G context feeds.`);
      const contextArticles = await fetchGeneralContextArticles({
        region,
        agentId: agent.id,
        portfolio: agent.portfolio,
        runWindow,
        runDate: now.toISOString(),
        maxArticles: 3
      });
      const contextInputs = contextArticles.map(toArticleInput);
      if (contextInputs.length > 0) {
        articleInputs = mergeArticleInputs(baseArticleInputs, contextInputs);
        newsStatus = "fallback-context";
      } else {
        console.warn(`[${agentId}/${region}] Context feed fetch returned no additional usable articles.`);
      }
    }

    const indexUrls = new Set(indices.map((i) => i.url));
    const articleUrls = new Set(articleInputs.map((a) => a.url));
    const allowedUrls = new Set([...articleUrls, ...indexUrls]);

    // Step 5: Generate brief using LLM
    console.log(`[${agentId}/${region}] Generating brief with ${articleInputs.length} articles...`);
    console.log(`[${agentId}/${region}] Article content lengths: ${articleInputs.map(a => (a.content?.length ?? 0)).join(", ")}`);
    let brief: BriefPost;
    try {
      brief = await generateBrief({
        agent,
        region,
        runWindow,
        articles: articleInputs,
        indices,
        previousBrief: previousBriefPrompt
      });
    } catch (generationError) {
      const message = (generationError as Error).message;
      console.error(`[${agentId}/${region}] Brief generation failed before validation:`, generationError);
      console.error(
        JSON.stringify({
          level: "error",
          event: "run_generation_failed",
          reasonCode: "llm_generation_failed",
          runId: runIdentifier,
          agentId: agent.id,
          portfolio: agent.portfolio,
          region,
          runWindow,
          runDate: now.toISOString(),
          error: message
        })
      );
      const fallback = await publishFallbackBrief({
        agent,
        region,
        runWindow,
        runId: runIdentifier,
        reason: "generation-failed",
        previousBrief,
        ingestResult,
        runIdentity,
        dryRun,
        now
      });
      if (fallback.ok) return { ...fallback, error: message };
      await logRunResult(runIdentifier, agent.id, region, "failed", message);
      return { agentId: agent.id, region, ok: false, status: "failed", error: message };
    }
    try {
      const marketSnapshot = await fetchPortfolioSnapshot(agent.portfolio);
      if (marketSnapshot.length > 0) {
        brief = { ...brief, marketSnapshot };
      }
    } catch (error) {
      console.warn(`[${agentId}/${region}] Market snapshot unavailable:`, error);
    }

    const parseIssues = (err: unknown): string[] => {
      try {
        return JSON.parse((err as Error).message);
      } catch {
        return [(err as Error).message];
      }
    };

    const runValidation = (candidate: BriefPost) => {
      const issues: string[] = [];
      const warnings: string[] = [];
      let validatedBrief: BriefPost | undefined;
      const numericIssues = validateNumericClaims(candidate, articleInputs);
      const evidenceResult = attachEvidenceToBrief({ brief: candidate, articles: articleInputs });
      try {
        validatedBrief = validateBrief(evidenceResult.brief, allowedUrls, indexUrls);
      } catch (err) {
        issues.push(...parseIssues(err));
      }
      
      // Separate FACTCHECK issues into warnings (non-critical) and issues (critical)
      // Approximate-match issues are warnings so we don't block briefs on numeric near-matches.
      // Critical: missing evidence tags, procurementActions/watchlist/supplierRadar (when not approximate)
      for (const numericIssue of numericIssues) {
        if (numericIssue.includes("FACTCHECK:")) {
          const isApproximateOnly = numericIssue.includes("(approximate match allowed)");
          const isCritical =
            !isApproximateOnly &&
            (numericIssue.includes("procurementActions") ||
              numericIssue.includes("watchlist") ||
              numericIssue.includes("supplierRadar") ||
              (numericIssue.includes("selectedArticles") && !numericIssue.includes("briefContent")));

          if (isCritical) {
            issues.push(numericIssue);
          } else {
            warnings.push(numericIssue);
          }
        } else {
          issues.push(numericIssue);
        }
      }

      for (const evIssue of evidenceResult.issues) {
        if (evIssue.startsWith("Claim needs verification:")) {
          warnings.push(evIssue);
        } else {
          issues.push(evIssue);
        }
      }

      if (warnings.length > 0) {
        console.log(`[${agentId}/${region}] Validation warnings (non-blocking):`, warnings);
      }
      
      if (evidenceResult.stats.total > 0) {
        console.log(
          `[${agentId}/${region}] Evidence stats: ${evidenceResult.stats.supported} supported, ${evidenceResult.stats.needsVerification} needs verification, ${evidenceResult.stats.analysis} analysis`
        );
      }
      return { validatedBrief, issues, warnings: warnings || [] };
    };

    // Step 7: Validate the brief (URLs + numeric factuality)
    let validationResult = runValidation(brief);
    let { validatedBrief, issues, warnings } = validationResult;

    if (issues.length > 0) {
      console.log(`[${agentId}/${region}] Validation failed, retrying...`, issues);
      console.log(
        JSON.stringify({
          level: "warn",
          event: "brief_validation_failed",
          reasonCode: "validation_failed",
          runId: runIdentifier,
          agentId: agent.id,
          region,
          runWindow,
          runDate: now.toISOString(),
          issuesCount: issues.length
        })
      );

      // Step 8: Retry with repair instructions
      const retryBrief = await generateBrief({
        agent,
        region,
        runWindow,
        articles: articleInputs,
        indices,
        repairIssues: issues,
        previousJson: JSON.stringify(brief),
        previousBrief: previousBriefPrompt
      });

      const retryResult = runValidation(retryBrief);
      validatedBrief = retryResult.validatedBrief;
      issues = retryResult.issues;
      warnings = retryResult.warnings || [];
      brief = retryBrief;
    }

    if (issues.length > 0 || !validatedBrief) {
      console.error(`[${agentId}/${region}] Final validation failed:`, issues);
      console.error(
        JSON.stringify({
          level: "error",
          event: "run_validation_failed",
          reasonCode: "validation_failed",
          runId: runIdentifier,
          agentId: agent.id,
          portfolio: agent.portfolio,
          region,
          runWindow,
          runDate: now.toISOString(),
          issuesCount: issues.length
        })
      );

      const fallback = await publishFallbackBrief({
        agent,
        region,
        runWindow,
        runId: runIdentifier,
        reason: "generation-failed",
        previousBrief,
        ingestResult,
        runIdentity,
        dryRun,
        now
      });
      if (fallback.ok) return { ...fallback, error: issues.join("; ") };

      const failedBrief = {
        ...brief,
        postId,
        runKey,
        agentId: agent.id,
        generationStatus: "generation-failed" as const,
        briefDay,
        status: "draft" as const,
        bodyMarkdown: `Evidence validation failed. Needs review. Issues: ${issues.join("; ")}`,
        sources: [],
        qualityReport: { issues, decision: "block" as const }
      };

      try {
        if (!dryRun) {
          await publishBrief(failedBrief, ingestResult, runIdentifier);
        }
      } catch (publishError) {
        console.error(
          `[${agentId}/${region}] Failed to write validation failure brief`,
          publishError
        );
      }
      await logRunResult(runIdentifier, agent.id, region, "failed", issues.join("; "));
      await logBriefRunResult({
        identity: runIdentity,
        runId: runIdentifier,
        status: "failed",
        finishedAt: new Date().toISOString(),
        metrics: buildMetrics({
          selectedCount: failedBrief.selectedArticles?.length ?? 0,
          briefLength: failedBrief.bodyMarkdown?.length ?? 0,
          usage: failedBrief.llmUsage
        }),
        error: issues.join("; "),
        dryRun
      });
      return { agentId: agent.id, region, ok: false, status: "failed", error: issues.join("; ") };
    }

    const validated = validatedBrief;
    const selectedArticles = validated.selectedArticles ?? [];
    const topStories = buildTopStories(selectedArticles);
    const normalizedStatus = normalizeNewsStatus(newsStatus, topStories);
    const deltaSinceLastRun = deriveDeltaSinceLastRun({
      currentDelta: validated.deltaSinceLastRun,
      topStories,
      previousBrief
    });

    const heroResolution = await resolveHeroImage({
      brief: validated,
      categorySlug: agent.portfolio,
      categoryLabel: agent.label,
      region,
      publishedAt: validated.publishedAt
    });

    const contextNote = buildContextNote(agent.label, topStories, normalizedStatus);

    const published: BriefPost = {
      ...validated,
      postId,
      runKey,
      agentId: agent.id,
      generationStatus: "published",
      briefDay,
      version: "v2",
      newsStatus: normalizedStatus,
      contextNote,
      selectedArticles,
      topStories,
      deltaSinceLastRun,
      heroImage: heroResolution.heroImage,
      heroImageUrl: heroResolution.heroImage.url,
      heroImageAlt: heroResolution.heroImage.alt,
      heroImageSourceUrl: heroResolution.heroSourceUrl ?? validated.heroImageSourceUrl
    };

    const v2Validation = validateBriefV2Record(published, { hasPreviousBrief: Boolean(previousBrief) });
    if (!v2Validation.ok) {
      throw new Error(`BriefV2 validation failed: ${v2Validation.issues.join("; ")}`);
    }
    
    // Step 9: Publish the brief
    console.log(`[${agentId}/${region}] Publishing brief...`);
    try {
      if (!dryRun) {
        await publishBrief(published, ingestResult, runIdentifier);
      }
    } catch (publishError) {
      console.error(`[${agentId}/${region}] Failed to publish brief`, { briefDay }, publishError);
      console.error(
        JSON.stringify({
          level: "error",
          event: "run_publish_failed",
          reasonCode: "dynamo_write_failed",
          runId: runIdentifier,
          agentId: agent.id,
          portfolio: agent.portfolio,
          region,
          runWindow,
          runDate: now.toISOString(),
          briefDay,
          error: (publishError as Error).message
        })
      );
      await logRunResult(runIdentifier, agent.id, region, "failed", (publishError as Error).message);
      await logBriefRunResult({
        identity: runIdentity,
        runId: runIdentifier,
        status: "failed",
        finishedAt: new Date().toISOString(),
        metrics: buildMetrics({
          selectedCount: published.selectedArticles?.length ?? 0,
          briefLength: published.bodyMarkdown?.length ?? 0,
          usage: published.llmUsage
        }),
        error: (publishError as Error).message,
        dryRun
      });
      return { agentId: agent.id, region, ok: false, status: "failed", error: (publishError as Error).message };
    }
    await logRunResult(runIdentifier, agent.id, region, dryRun ? "dry-run" : "published");
    await logBriefRunResult({
      identity: runIdentity,
      runId: runIdentifier,
      status: dryRun ? "dry-run" : "succeeded",
      finishedAt: new Date().toISOString(),
      metrics: buildMetrics({
        selectedCount: published.selectedArticles?.length ?? 0,
        briefLength: published.bodyMarkdown?.length ?? 0,
        usage: published.llmUsage
      }),
      dryRun
    });
    console.log(
      JSON.stringify({
        level: "info",
        event: "brief_published",
        runId: runIdentifier,
        agentId: agent.id,
        region,
        briefId: published.postId,
        sourcesCount: published.sources?.length ?? 0
      })
    );
    
    console.log(`[${agentId}/${region}] ✓ Brief ${dryRun ? "validated (dry-run)" : "published"} successfully`);
    return { agentId: agent.id, region, ok: true, status: dryRun ? "dry-run" : "published" };
    
  } catch (err) {
    console.error(`[${agentId}/${region}] Error:`, err);
    console.error(
      JSON.stringify({
        level: "error",
        event: "run_unhandled_error",
        reasonCode: "unhandled_error",
        runId: runIdentifier,
        agentId: agent.id,
        portfolio: agent.portfolio,
        region,
        runWindow,
        runDate: now.toISOString(),
        error: (err as Error).message
      })
    );
    await logRunResult(runIdentifier, agent.id, region, "failed", (err as Error).message);
    await logBriefRunResult({
      identity: runIdentity,
      runId: runIdentifier,
      status: "failed",
      finishedAt: new Date().toISOString(),
      metrics: buildMetrics({
        selectedCount: 0,
        briefLength: 0
      }),
      error: (err as Error).message,
      dryRun
    });
    return { agentId: agent.id, region, ok: false, status: "failed", error: (err as Error).message };
  }
}
