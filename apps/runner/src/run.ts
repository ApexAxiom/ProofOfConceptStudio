import { BriefPost, REGIONS, RegionSlug, RunWindow, getBriefDayKey, indicesForRegion, runWindowForRegion } from "@proof/shared";
import { expandAgentsByRegion, loadAgents } from "./agents/config.js";
import { auditCoverage } from "./brief-coverage/audit.js";
import { expectedCoverageDayKey } from "./brief-coverage/day.js";
import { PlaceholderReason } from "./brief-coverage/placeholders.js";
import { resolveFallbackBrief } from "./brief-coverage/fallback.js";
import { ingestAgent, ArticleDetail, IngestResult } from "./ingest/fetch.js";
import { generateBrief } from "./llm/openai.js";
import type { ArticleInput } from "./llm/openai.js";
import { validateBrief } from "./publish/validate.js";
import { validateNumericClaims } from "./publish/factuality.js";
import { attachEvidenceToBrief } from "./publish/evidence.js";
import { publishBrief, logRunResult } from "./publish/dynamo.js";
import crypto from "node:crypto";
import { findImageFromPage, findBestImageFromSources } from "./images/image-scraper.js";
import { runMarketDashboard } from "./market/dashboard.js";
import { getLatestPublishedBrief } from "./db/previous-brief.js";
import { fetchPortfolioSnapshot } from "./market/portfolio-snapshot.js";

type RunStatus = "published" | "no-updates" | "failed";
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
}): Promise<RunResult> {
  const ingestResult: IngestResult =
    options.ingestResult ?? {
      articles: [],
      scannedSources: [],
      metrics: { collectedCount: 0, dedupedCount: 0, extractedCount: 0 }
    };

  const brief = resolveFallbackBrief({
    agent: options.agent,
    region: options.region,
    runWindow: options.runWindow,
    reason: options.reason,
    previousBrief: options.previousBrief,
    now: options.now
  });

  try {
    await publishBrief(brief, ingestResult, options.runId);
    const status = options.reason === "no-updates" ? "no-updates" : "published";
    await logRunResult(options.runId, options.agent.id, options.region, status);
    return { agentId: options.agent.id, region: options.region, ok: true, status };
  } catch (error) {
    const message = (error as Error).message;
    await logRunResult(options.runId, options.agent.id, options.region, "failed", message);
    return { agentId: options.agent.id, region: options.region, ok: false, status: "failed", error: message };
  }
}

function dayKeyToMiddayUtc(dayKey: string): Date {
  return new Date(`${dayKey}T12:00:00.000Z`);
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

    for (const missing of coverage.missingAgents) {
      const agent = agents.find((candidate) => candidate.id === missing.agentId);
      if (!agent) continue;
      const previousBrief = await getLatestPublishedBrief({
        portfolio: agent.portfolio,
        region: missing.region,
        beforeIso: targetDate.toISOString()
      });

      await publishFallbackBrief({
        agent,
        region: missing.region,
        runWindow: runWindowForRegion(missing.region),
        runId: options.runId,
        reason: "no-updates",
        previousBrief,
        ingestResult: emptyIngest,
        now: targetDate
      });
    }

    console.warn(
      JSON.stringify({
        level: "warn",
        event: "coverage_backfill_published",
        runId: options.runId,
        region,
        dayKey: previousDayKey,
        missingCount: coverage.missingAgents.length
      })
    );
  }
}

async function publishPlaceholder({
  agentId,
  region,
  runWindow,
  runId,
  reason
}: {
  agentId: string;
  region: RegionSlug;
  runWindow: RunWindow;
  runId: string;
  reason: PlaceholderReason;
}): Promise<RunResult> {
  const agents = loadAgents();
  const agent = agents.find((a) => a.id === agentId);
  if (!agent) {
    const error = `Agent ${agentId} not found for placeholder`;
    await logRunResult(runId, agentId, region, "failed", error);
    return { agentId, region, ok: false, status: "failed", error };
  }

  const previousBrief = await getLatestPublishedBrief({
    portfolio: agent.portfolio,
    region,
    beforeIso: new Date().toISOString()
  });
  const fallback = await publishFallbackBrief({
    agent,
    region,
    runWindow,
    runId,
    reason,
    previousBrief,
    ingestResult: { articles: [], scannedSources: [], metrics: { collectedCount: 0, dedupedCount: 0, extractedCount: 0 } }
  });
  if (!fallback.ok) {
    console.error(`[${agentId}/${region}] Placeholder publish failed`, fallback.error);
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

/**
 * Main cron handler - runs all agents for the specified run window
 */
export async function handleCron(
  runWindow: RunWindow,
  opts?: { runId?: string; scheduled?: boolean; regions?: RegionSlug[]; agentIds?: string[] }
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
    tasks.push(() => runAgent(agent.id, region, runWindow, runId));
  }

  // Run briefs with concurrency limit of 2 to prevent overload
  const results = await runWithLimit(tasks, 2);

  // Run market dashboard agents after normal briefs are published
  const dashboardTargets = expandAgentsByRegion({ agents: filteredDashboardAgents, regions: regionList });
  for (const { agent, region } of dashboardTargets) {
    const dashboardResult = await runMarketDashboard(agent, region, runWindow, runId);
    results.push(dashboardResult);
  }

  const summary = results.reduce(
    (acc, r) => {
      if (r.status === "published") acc.published += 1;
      else if (r.status === "no-updates") acc.noUpdates += 1;
      else acc.failed += 1;
      return acc;
    },
    { published: 0, noUpdates: 0, failed: 0 }
  );

  const allRegions = Object.keys(REGIONS) as RegionSlug[];
  const auditRegions = opts?.scheduled ? allRegions : (regionList ?? allRegions);
  const coverageAgentIds = opts?.scheduled ? undefined : opts?.agentIds;
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

  if (missingCount > 0) {
    console.warn(
      JSON.stringify({
        level: "warn",
        event: "coverage_missing",
        runId,
        regions: auditRegions,
        missingCount,
        missingAgentIds: missingByRegion.map((m) => m.agentId)
      })
    );

    const rerunTasks = missingByRegion.map((missing) => () =>
      runWithTimeout(
        runAgent(missing.agentId, missing.region, runWindowForRegion(missing.region), runId),
        10 * 60 * 1000,
        `rerun-${missing.agentId}`
      )
        .catch((error) => ({
          agentId: missing.agentId,
          region: missing.region,
          ok: false,
          status: "failed",
          error: (error as Error).message
        }))
    );

    const rerunResults = await runWithLimit(rerunTasks, 2);
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
            reason
          });
      });
      await runWithLimit(placeholderTasks, 2);
      console.warn(
        JSON.stringify({
          level: "warn",
          event: "coverage_placeholder_published",
          runId,
          regions: auditRegions,
          missingAgentIds: stillMissing.map((m) => m.agentId)
        })
      );
    }
  } else {
    console.log(
      JSON.stringify({
        level: "info",
        event: "coverage_ok",
        runId,
        regions: auditRegions,
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
        runId,
        error: (error as Error).message
      })
    );
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
  runId?: string
): Promise<RunResult> {
  const agents = loadAgents();
  const agent = agents.find((a) => a.id === agentId);
  
  if (!agent) {
    const error = `Agent ${agentId} not found`;
    await logRunResult(runId ?? crypto.randomUUID(), agentId, region, "failed", error);
    return { agentId, region, ok: false, status: "failed", error };
  }

  const feeds = agent.feedsByRegion[region];
  if (!feeds || feeds.length === 0) {
    const error = `Region ${region} is not configured for agent ${agentId}`;
    await logRunResult(runId ?? crypto.randomUUID(), agentId, region, "failed", error);
    return { agentId, region, ok: false, status: "failed", error };
  }

  const runIdentifier = runId ?? crypto.randomUUID();
  const briefDay = getBriefDayKey(region, new Date());
  const emptyIngestResult = {
    articles: [],
    scannedSources: [],
    metrics: { collectedCount: 0, dedupedCount: 0, extractedCount: 0 }
  };

  try {
    // Step 1: Ingest articles from all feeds
    console.log(`[${agentId}/${region}] Ingesting articles...`);
    let ingestResult;
    try {
      ingestResult = await ingestAgent(agent, region);
    } catch (ingestErr) {
      console.error(`[${agentId}/${region}] Ingestion failed:`, ingestErr);
      const error = `Ingestion error: ${(ingestErr as Error).message}`;
      const previousBrief = await getLatestPublishedBrief({
        portfolio: agent.portfolio,
        region,
        beforeIso: new Date().toISOString()
      });
      const fallback = await publishFallbackBrief({
        agent,
        region,
        runWindow,
        runId: runIdentifier,
        reason: "generation-failed",
        previousBrief,
        ingestResult: emptyIngestResult
      });
      if (fallback.ok) return fallback;
      await logRunResult(runIdentifier, agent.id, region, "failed", error);
      return { agentId: agent.id, region, ok: false, status: "failed", error };
    }
    
    const articles: ArticleSource[] = ingestResult.articles ?? [];
    
    // Minimum articles required - at least 1, but preferably the configured amount
    const minRequired = Math.max(1, Math.min(agent.articlesPerRun ?? 3, 2));
    
    if (articles.length === 0) {
      const error = `No articles found after ingestion (scanned ${ingestResult.scannedSources?.length ?? 0} sources)`;
      console.error(`[${agentId}/${region}] ${error}`);
      const previousBrief = await getLatestPublishedBrief({
        portfolio: agent.portfolio,
        region,
        beforeIso: new Date().toISOString()
      });
      const fallback = await publishFallbackBrief({
        agent,
        region,
        runWindow,
        runId: runIdentifier,
        reason: "no-updates",
        previousBrief,
        ingestResult
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
        region,
        metrics: ingestResult.metrics,
        scannedSourcesCount: ingestResult.scannedSources?.length ?? 0
      })
    );
    
    // Step 2: Get market indices for this region/portfolio
    const indices = indicesForRegion(agent.portfolio, region);
    
    // Step 3: Build allowed URLs set (for validation)
    const indexUrls = new Set(indices.map((i) => i.url));
    const articleUrls = new Set(articles.map((a) => a.url));
    const allowedUrls = new Set([...articleUrls, ...indexUrls]);
    
    // Step 4: Convert articles to LLM input format
    const articleInputs: ArticleInput[] = articles.map(toArticleInput);
    
    // Step 5: Look up previous brief for delta context
    const previousBrief = await getLatestPublishedBrief({
      portfolio: agent.portfolio,
      region,
      beforeIso: new Date().toISOString()
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

    // Step 6: Generate brief using LLM
    console.log(`[${agentId}/${region}] Generating brief with ${articleInputs.length} articles...`);
    console.log(`[${agentId}/${region}] Article content lengths: ${articleInputs.map(a => (a.content?.length ?? 0)).join(", ")}`);
    let brief = await generateBrief({
      agent,
      region,
      runWindow,
      articles: articleInputs,
      indices,
      previousBrief: previousBriefPrompt
    });
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
      // Critical: procurementActions, watchlist, supplier names
      // Non-critical: summary, highlights, deltaSinceLastRun (general analysis)
      for (const numericIssue of numericIssues) {
        if (numericIssue.includes("FACTCHECK:")) {
          const isCritical = 
            numericIssue.includes("procurementActions") ||
            numericIssue.includes("watchlist") ||
            numericIssue.includes("supplierRadar") ||
            numericIssue.includes("selectedArticles") && !numericIssue.includes("briefContent");
          
          if (isCritical) {
            issues.push(numericIssue);
          } else {
            warnings.push(numericIssue);
          }
        } else {
          issues.push(numericIssue);
        }
      }
      
      issues.push(...evidenceResult.issues);
      
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
          runId: runIdentifier,
          agentId: agent.id,
          region,
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

      const fallback = await publishFallbackBrief({
        agent,
        region,
        runWindow,
        runId: runIdentifier,
        reason: "generation-failed",
        previousBrief,
        ingestResult
      });
      if (fallback.ok) return { ...fallback, error: issues.join("; ") };

      const failedBrief = {
        ...brief,
        agentId: agent.id,
        generationStatus: "generation-failed" as const,
        briefDay,
        status: "draft" as const,
        bodyMarkdown: `Evidence validation failed. Needs review. Issues: ${issues.join("; ")}`,
        sources: [],
        qualityReport: { issues, decision: "block" as const }
      };

      try {
        await publishBrief(failedBrief, ingestResult, runIdentifier);
      } catch (publishError) {
        console.error(
          `[${agentId}/${region}] Failed to write validation failure brief`,
          publishError
        );
      }
      await logRunResult(runIdentifier, agent.id, region, "failed", issues.join("; "));
      return { agentId: agent.id, region, ok: false, status: "failed", error: issues.join("; ") };
    }

    const validated = validatedBrief;

    // Step 8: Enrich images deterministically
    const enrichedArticles = await Promise.all(
      (validated.selectedArticles || []).map(async (article) => {
        if (article.imageUrl && article.imageUrl.startsWith("http")) {
          return article;
        }
        const scraped = await findImageFromPage(article.url);
        if (scraped?.url) {
          return { ...article, imageUrl: scraped.url, imageAlt: scraped.alt ?? article.imageAlt };
        }
        return article;
      })
    );

    const heroFromSelection = enrichedArticles.find((a) => a.url === validated.heroImageSourceUrl) || enrichedArticles[0];
    let heroImageUrl = heroFromSelection?.imageUrl || validated.heroImageUrl;
    let heroImageAlt = validated.heroImageAlt || heroFromSelection?.title || validated.title;

    if (!heroImageUrl) {
      const scrapedHero = await findBestImageFromSources(
        enrichedArticles.map((a) => ({ url: a.url, title: a.title, publisher: a.sourceName }))
      );
      heroImageUrl = scrapedHero?.url;
      heroImageAlt = heroImageAlt || scrapedHero?.alt || validated.title;
    }

    const published = {
      ...validated,
      agentId: agent.id,
      generationStatus: "published" as const,
      briefDay,
      selectedArticles: enrichedArticles,
      heroImageUrl,
      heroImageSourceUrl: heroFromSelection?.url || validated.heroImageSourceUrl,
      heroImageAlt
    };
    
    // Step 9: Publish the brief
    console.log(`[${agentId}/${region}] Publishing brief...`);
    try {
      await publishBrief(published, ingestResult, runIdentifier);
    } catch (publishError) {
      console.error(`[${agentId}/${region}] Failed to publish brief`, { briefDay }, publishError);
      await logRunResult(runIdentifier, agent.id, region, "failed", (publishError as Error).message);
      return { agentId: agent.id, region, ok: false, status: "failed", error: (publishError as Error).message };
    }
    await logRunResult(runIdentifier, agent.id, region, "published");
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
    
    console.log(`[${agentId}/${region}] ✓ Brief published successfully`);
    return { agentId: agent.id, region, ok: true, status: "published" };
    
  } catch (err) {
    console.error(`[${agentId}/${region}] Error:`, err);
    await logRunResult(runIdentifier, agent.id, region, "failed", (err as Error).message);
    return { agentId: agent.id, region, ok: false, status: "failed", error: (err as Error).message };
  }
}
