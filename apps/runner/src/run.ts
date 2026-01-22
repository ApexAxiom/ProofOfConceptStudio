import { BriefPost, RegionSlug, RunWindow, indicesForRegion } from "@proof/shared";
import { expandAgentsByRegion, loadAgents } from "./agents/config.js";
import { ingestAgent, ArticleDetail } from "./ingest/fetch.js";
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

type RunResult = { agentId: string; region: RegionSlug; ok: boolean; error?: string };

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
  opts?: { runId?: string; scheduled?: boolean; regions?: RegionSlug[] }
) {
  const agents = loadAgents();
  const normalAgents = agents.filter((a) => a.mode !== "market-dashboard");
  const dashboardAgents = agents.filter((a) => a.mode === "market-dashboard");
  const runId = opts?.runId ?? crypto.randomUUID();
  const tasks: (() => Promise<RunResult>)[] = [];
  const regionFilter = opts?.regions ? new Set(opts.regions) : null;

  const regionList = regionFilter ? Array.from(regionFilter) : undefined;
  const targetedAgents = expandAgentsByRegion({ agents: normalAgents, regions: regionList });

  for (const { agent, region } of targetedAgents) {
    tasks.push(() => runAgent(agent.id, region, runWindow, runId));
  }

  const results = await runWithLimit(tasks, 4);

  // Run market dashboard agents after normal briefs are published
  const dashboardTargets = expandAgentsByRegion({ agents: dashboardAgents, regions: regionList });
  for (const { agent, region } of dashboardTargets) {
    const dashboardResult = await runMarketDashboard(agent, region, runWindow, runId);
    results.push(dashboardResult);
  }
  const summary = results.reduce(
    (acc, r) => {
      if ((r as RunResult).ok) acc.successes += 1;
      else acc.failures += 1;
      return acc;
    },
    { successes: 0, failures: 0 }
  );
  
  return { runId, ok: summary.failures === 0, ...summary };
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
    return { agentId, region, ok: false, error };
  }

  const feeds = agent.feedsByRegion[region];
  if (!feeds || feeds.length === 0) {
    const error = `Region ${region} is not configured for agent ${agentId}`;
    await logRunResult(runId ?? crypto.randomUUID(), agentId, region, "failed", error);
    return { agentId, region, ok: false, error };
  }

  const runIdentifier = runId ?? crypto.randomUUID();

  try {
    // Step 1: Ingest articles from all feeds
    console.log(`[${agentId}/${region}] Ingesting articles...`);
    let ingestResult;
    try {
      ingestResult = await ingestAgent(agent, region);
    } catch (ingestErr) {
      console.error(`[${agentId}/${region}] Ingestion failed:`, ingestErr);
      const error = `Ingestion error: ${(ingestErr as Error).message}`;
      await logRunResult(runIdentifier, agent.id, region, "failed", error);
      return { agentId: agent.id, region, ok: false, error };
    }
    
    const articles: ArticleSource[] = ingestResult.articles ?? [];
    
    // Minimum articles required - at least 1, but preferably the configured amount
    const minRequired = Math.max(1, Math.min(agent.articlesPerRun ?? 3, 2));
    
    if (articles.length === 0) {
      const error = `No articles found after ingestion (scanned ${ingestResult.scannedSources?.length ?? 0} sources)`;
      console.error(`[${agentId}/${region}] ${error}`);
      await logRunResult(runIdentifier, agent.id, region, "failed", error);
      return { agentId: agent.id, region, ok: false, error };
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
    console.log(`[${agentId}/${region}] Generating brief...`);
    let brief = await generateBrief({
      agent,
      region,
      runWindow,
      articles: articleInputs,
      indices,
      previousBrief: previousBriefPrompt
    });

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

      const failedBrief = {
        ...brief,
        status: "draft" as const,
        bodyMarkdown: `Evidence validation failed. Needs review. Issues: ${issues.join("; ")}`,
        sources: [],
        qualityReport: { issues, decision: "block" as const }
      };

      await publishBrief(failedBrief, ingestResult, runIdentifier);
      await logRunResult(runIdentifier, agent.id, region, "failed", issues.join("; "));
      return { agentId: agent.id, region, ok: false, error: issues.join("; ") };
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
      selectedArticles: enrichedArticles,
      heroImageUrl,
      heroImageSourceUrl: heroFromSelection?.url || validated.heroImageSourceUrl,
      heroImageAlt
    };
    
    // Step 9: Publish the brief
    console.log(`[${agentId}/${region}] Publishing brief...`);
    await publishBrief(published, ingestResult, runIdentifier);
    await logRunResult(runIdentifier, agent.id, region, "success");
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
    return { agentId: agent.id, region, ok: true };
    
  } catch (err) {
    console.error(`[${agentId}/${region}] Error:`, err);
    await logRunResult(runIdentifier, agent.id, region, "failed", (err as Error).message);
    return { agentId: agent.id, region, ok: false, error: (err as Error).message };
  }
}
