import fs from "node:fs";
import path from "node:path";
import { AgentConfig, regionLabel, RegionSlug, RunWindow } from "@proof/shared";
import { loadAgents } from "./agents/config.js";
import { ingestAgent } from "./ingest/fetch.js";
import { generateBrief } from "./llm/openai.js";
import { validateBrief } from "./publish/validate.js";
import { publishBrief, logRunResult } from "./publish/dynamo.js";
import { v4 as uuidv4 } from "uuid";

export async function handleCron(runWindow: RunWindow) {
  const agents = loadAgents();
  const runId = uuidv4();
  for (const agent of agents) {
    for (const region of Object.keys(agent.feedsByRegion) as RegionSlug[]) {
      await runAgent(agent.id, region, runWindow, runId);
    }
  }
}

export async function runAgent(agentId: string, region: RegionSlug, runWindow: RunWindow, runId?: string) {
  const agents = loadAgents();
  const agent = agents.find((a) => a.id === agentId);
  if (!agent) throw new Error(`Agent ${agentId} not found`);
  const runIdentifier = runId ?? uuidv4();
  const ingestResult = await ingestAgent(agent, region);
  const brief = await generateBrief({
    agent,
    region,
    runWindow,
    articles: ingestResult.articles
  });
  const validated = validateBrief(brief);
  await publishBrief(validated, ingestResult, runIdentifier);
  await logRunResult(runIdentifier, agent.id, region, "success");
}

if (require.main === module) {
  const [, , runWindowArg] = process.argv;
  const runWindow = (runWindowArg as RunWindow) || "am";
  handleCron(runWindow).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
