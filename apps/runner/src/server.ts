import Fastify from "fastify";
import { REGIONS, RegionSlug, runWindowForRegion, type RunWindow } from "@proof/shared";
import { handleCron, runAgent } from "./run.js";
import { initializeSecrets } from "./lib/secrets.js";
import crypto from "node:crypto";
import { expandAgentsByRegion, loadAgents } from "./agents/config.js";
import { requiredArticleCount } from "./llm/prompts.js";

function isWithinScheduledWindow(runWindow: RunWindow, now: Date, toleranceMinutes = 10): boolean {
  const windowConfig = runWindow === "apac"
    ? { timeZone: REGIONS.au.timeZone, h: 6, m: 0 }
    : { timeZone: REGIONS["us-mx-la-lng"].timeZone, h: 6, m: 0 };

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: windowConfig.timeZone,
    hour: "numeric",
    minute: "numeric",
    hour12: false
  });
  const parts = formatter.formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  const diff = Math.abs((hour * 60 + minute) - (windowConfig.h * 60 + windowConfig.m));
  return diff <= toleranceMinutes;
}

async function main() {
  // Load secrets from AWS Secrets Manager before starting the server
  await initializeSecrets();

  const PORT = Number(process.env.PORT ?? 8080);
  const CRON_SECRET = process.env.CRON_SECRET ?? "";

  const fastify = Fastify({ logger: true });

  fastify.get("/health", async () => ({ status: "ok" }));
  fastify.get("/healthz", async () => ({ status: "ok" }));

  fastify.get("/agents", async () => {
    const agents = loadAgents();
    const expanded = expandAgentsByRegion({ agents });

    return expanded.map(({ agent, region, feeds }) => ({
      id: agent.id,
      region,
      portfolio: agent.portfolio,
      label: agent.label,
      description: agent.description,
      articlesPerRun: requiredArticleCount(agent),
      feeds
    }));
  });

  fastify.post("/cron", async (request, reply) => {
    if (!CRON_SECRET || request.headers.authorization !== `Bearer ${CRON_SECRET}`) {
      reply.code(401).send({ error: "unauthorized" });
      return;
    }
    const body = (request.body as any) || {};
    const runId = crypto.randomUUID();
    const now = new Date();

    const regionInput = Array.isArray(body?.regions)
      ? body.regions
      : body.region
        ? [body.region]
        : undefined;

    const requestedRegions = regionInput
      ?.map((r: string) => r as RegionSlug)
      .filter((r: RegionSlug) => Boolean(REGIONS[r]));

    type RegionRun = { region: RegionSlug; runWindow: RunWindow; inWindow: boolean };

    const regionRuns = (requestedRegions?.length ? requestedRegions : (Object.keys(REGIONS) as RegionSlug[])).map(
      (region: RegionSlug): RegionRun => {
        const localizedRunWindow: RunWindow = body.runWindow ?? runWindowForRegion(region);
        const inWindow =
          body.scheduled === true && !body.force ? isWithinScheduledWindow(localizedRunWindow, now) : true;

        return { region, runWindow: localizedRunWindow, inWindow };
      }
    );

    const readyRegions = body.scheduled === true && !body.force
      ? regionRuns.filter((r: RegionRun) => r.inWindow)
      : regionRuns;

    if (body.scheduled === true && readyRegions.length === 0) {
      reply.code(202).send({ ok: true, accepted: true, skipped: true, runId });
      return;
    }

    reply.code(202).send({
      ok: true,
      accepted: true,
      runId,
      regions: readyRegions.map((r: RegionRun) => ({ region: r.region, runWindow: r.runWindow }))
    });

    setImmediate(() => {
      Promise.all(
        readyRegions.map((target: RegionRun) =>
          handleCron(target.runWindow, {
            runId,
            scheduled: body.scheduled === true,
            regions: [target.region]
          })
        )
      ).catch((err) => fastify.log.error(err));
    });
  });

  fastify.post<{ Params: { agentId: string } }>("/run/:agentId", async (request, reply) => {
    if (!CRON_SECRET || request.headers.authorization !== `Bearer ${CRON_SECRET}`) {
      reply.code(401).send({ error: "unauthorized" });
      return;
    }
    const { agentId } = request.params;
    const body = (request.body as any) || {};
    reply.code(202).send({ ok: true, accepted: true });
    setImmediate(() => {
      const runWindow: RunWindow = body.runWindow ?? runWindowForRegion(body.region ?? "us-mx-la-lng");
      runAgent(agentId, body.region, runWindow).catch((err) => fastify.log.error(err));
    });
  });

  await fastify.listen({ host: "0.0.0.0", port: PORT });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
