import { RegionSlug, RunWindow, indicesForRegion } from "@proof/shared";
import { expandAgentsByRegion, loadAgents } from "./agents/config.js";
import { ingestAgent, ArticleDetail } from "./ingest/fetch.js";
import { generateBrief, ArticleInput } from "./llm/openai.js";
import { validateBrief } from "./publish/validate.js";
import { publishBrief, logRunResult } from "./publish/dynamo.js";
import crypto from "node:crypto";
import { findImageFromPage, findBestImageFromSources } from "./images/image-scraper.js";
import { runMarketDashboard } from "./market/dashboard.js";

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

/**
 * Converts ArticleDetail to ArticleInput for the LLM
 */
function toArticleInput(article: ArticleDetail): ArticleInput {
  return {
    title: article.title,
    url: article.url,
    content: article.content,
    ogImageUrl: article.ogImageUrl,
    sourceName: article.sourceName,
    publishedAt: article.published
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
    const ingestResult = await ingestAgent(agent, region);
    const articles = ingestResult.articles ?? [];
    
    if (articles.length === 0) {
      const error = "No articles found after ingestion";
      await logRunResult(runIdentifier, agent.id, region, "failed", error);
      return { agentId: agent.id, region, ok: false, error };
    }
    
    console.log(`[${agentId}/${region}] Found ${articles.length} articles`);
    
    // Step 2: Get market indices for this region/portfolio
    const indices = indicesForRegion(agent.portfolio, region);
    
    // Step 3: Build allowed URLs set (for validation)
    const indexUrls = new Set(indices.map((i) => i.url));
    const articleUrls = new Set(articles.map((a) => a.url));
    const allowedUrls = new Set([...articleUrls, ...indexUrls]);
    
    // Step 4: Convert articles to LLM input format
    const articleInputs: ArticleInput[] = articles.map(toArticleInput);
    
    // Step 5: Generate brief using LLM
    console.log(`[${agentId}/${region}] Generating brief...`);
    let brief = await generateBrief({
      agent,
      region,
      runWindow,
      articles: articleInputs,
      indices
    });
    
    // Step 6: Validate the brief
    let validated;
    try {
      validated = validateBrief(brief, allowedUrls, indexUrls);
    } catch (err) {
      // Parse validation issues
      const issues = (() => {
        try {
          return JSON.parse((err as Error).message);
        } catch {
          return [(err as Error).message];
        }
      })();
      
      console.log(`[${agentId}/${region}] Validation failed, retrying...`, issues);
      
      // Step 7: Retry with repair instructions
      const retryBrief = await generateBrief({
        agent,
        region,
        runWindow,
        articles: articleInputs,
        indices,
        repairIssues: issues,
        previousJson: JSON.stringify(brief)
      });
      
      try {
        validated = validateBrief(retryBrief, allowedUrls, indexUrls);
      } catch (finalErr) {
        // Final validation failed - publish as failed
        const problem = (() => {
          try {
            return JSON.parse((finalErr as Error).message);
          } catch {
            return [(finalErr as Error).message];
          }
        })();
        
        console.error(`[${agentId}/${region}] Final validation failed:`, problem);
        
        const failedBrief = {
          ...brief,
          status: "failed" as const,
          bodyMarkdown: `Validation failed. Issues: ${problem.join("; ")}`,
          sources: [],
          qualityReport: { issues: problem, decision: "block" as const }
        };
        
        await publishBrief(failedBrief, ingestResult, runIdentifier);
        await logRunResult(runIdentifier, agent.id, region, "failed", problem.join("; "));
        return { agentId: agent.id, region, ok: false, error: problem.join("; ") };
      }
    }

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
    
    console.log(`[${agentId}/${region}] ✓ Brief published successfully`);
    return { agentId: agent.id, region, ok: true };
    
  } catch (err) {
    console.error(`[${agentId}/${region}] Error:`, err);
    await logRunResult(runIdentifier, agent.id, region, "failed", (err as Error).message);
    return { agentId: agent.id, region, ok: false, error: (err as Error).message };
  }
}

