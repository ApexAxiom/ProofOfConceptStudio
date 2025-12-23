import { RegionSlug, RunWindow, indicesForRegion } from "@proof/shared";
import { loadAgents } from "./agents/config.js";
import { ingestAgent } from "./ingest/fetch.js";
import { generateBrief } from "./llm/openai.js";
import { validateBrief } from "./publish/validate.js";
import { publishBrief, logRunResult } from "./publish/dynamo.js";
import { v4 as uuidv4 } from "uuid";

type RunResult = { agentId: string; region: RegionSlug; ok: boolean; error?: string };

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

export async function handleCron(runWindow: RunWindow, opts?: { runId?: string; scheduled?: boolean }) {
  const agents = loadAgents();
  const runId = opts?.runId ?? uuidv4();
  const tasks: (() => Promise<RunResult>)[] = [];
  for (const agent of agents) {
    for (const region of Object.keys(agent.feedsByRegion) as RegionSlug[]) {
      tasks.push(() => runAgent(agent.id, region, runWindow, runId));
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

export async function runAgent(agentId: string, region: RegionSlug, runWindow: RunWindow, runId?: string): Promise<RunResult> {
  const agents = loadAgents();
  const agent = agents.find((a) => a.id === agentId);
  if (!agent) {
    const error = `Agent ${agentId} not found`;
    await logRunResult(runId ?? uuidv4(), agentId, region, "failed", error);
    return { agentId, region, ok: false, error };
  }
  const runIdentifier = runId ?? uuidv4();
  try {
    const ingestResult = await ingestAgent(agent, region);
    const articles = ingestResult.articles ?? [];
    const indices = indicesForRegion(agent.portfolio, region);
    const indexUrls = new Set(indices.map((i) => i.url));
    const allowedUrls = new Set<string>([...articles.map((a: any) => a.url), ...indexUrls]);
    let brief = await generateBrief({
      agent,
      region,
      runWindow,
      articles,
      indices
    });
    let validated: any;
    try {
      validated = validateBrief(brief, allowedUrls, indexUrls);
    } catch (err) {
      const issues = (() => {
        try {
          return JSON.parse((err as Error).message);
        } catch {
          return [(err as Error).message];
        }
      })();
      const retryBrief = await generateBrief({
        agent,
        region,
        runWindow,
        articles,
        indices,
        repairIssues: issues,
        previousJson: JSON.stringify(brief)
      });
      try {
        validated = validateBrief(retryBrief, allowedUrls, indexUrls);
      } catch (finalErr) {
        const problem = (() => {
          try {
            return JSON.parse((finalErr as Error).message);
          } catch {
            return [(finalErr as Error).message];
          }
        })();
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
    const hero = articles.find((a: any) => a.ogImageUrl && a.ogImageUrl.startsWith("https"));
    const published = {
      ...validated,
      heroImageUrl: hero?.ogImageUrl,
      heroImageSourceUrl: hero?.url,
      heroImageAlt: validated.title
    };
    await publishBrief(published, ingestResult, runIdentifier);
    await logRunResult(runIdentifier, agent.id, region, "success");
    return { agentId: agent.id, region, ok: true };
  } catch (err) {
    await logRunResult(runIdentifier, agent.id, region, "failed", (err as Error).message);
    return { agentId: agent.id, region, ok: false, error: (err as Error).message };
  }
}
