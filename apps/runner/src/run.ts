import { RegionSlug, RunWindow, indicesForRegion } from "@proof/shared";
import { loadAgents } from "./agents/config.js";
import { ingestAgent, ArticleDetail } from "./ingest/fetch.js";
import { generateBrief, ArticleInput } from "./llm/openai.js";
import { validateBrief } from "./publish/validate.js";
import { publishBrief, logRunResult } from "./publish/dynamo.js";
import crypto from "node:crypto";

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
  const runId = opts?.runId ?? crypto.randomUUID();
  const tasks: (() => Promise<RunResult>)[] = [];
  const regionFilter = opts?.regions ? new Set(opts.regions) : null;
  
  for (const agent of agents) {
    for (const region of Object.keys(agent.feedsByRegion) as RegionSlug[]) {
      if (!regionFilter || regionFilter.has(region)) {
        tasks.push(() => runAgent(agent.id, region, runWindow, runId));
      }
    }
  }
  
  const results = await runWithLimit(tasks, 4);
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
    
    // Step 8: Ensure hero image is set from selected articles
    const published = {
      ...validated,
      heroImageUrl: validated.heroImageUrl || findBestHeroImage(validated, articles),
      heroImageSourceUrl: validated.heroImageSourceUrl || validated.selectedArticles?.[0]?.url,
      heroImageAlt: validated.heroImageAlt || validated.title
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

/**
 * Finds the best hero image from the validated brief or articles
 */
function findBestHeroImage(brief: any, articles: ArticleDetail[]): string | undefined {
  // First check selected articles in the brief
  for (const selected of brief.selectedArticles || []) {
    if (selected.imageUrl && selected.imageUrl.startsWith("https")) {
      return selected.imageUrl;
    }
  }
  
  // Fall back to ingested articles
  for (const article of articles) {
    if (article.ogImageUrl && article.ogImageUrl.startsWith("https")) {
      return article.ogImageUrl;
    }
  }
  
  return undefined;
}
