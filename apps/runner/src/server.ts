import Fastify from "fastify";
import { REGIONS, RegionSlug, runWindowFromDate, type RunWindow } from "@proof/shared";
import { handleCron, runAgent } from "./run.js";
import { initializeSecrets } from "./lib/secrets.js";
import crypto from "node:crypto";

function isWithinScheduledWindow(runWindow: RunWindow, now: Date, timeZone: string, toleranceMinutes = 10): boolean {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "numeric",
    hour12: false
  });
  const parts = formatter.formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  const target = runWindow === "am" ? { h: 6, m: 0 } : { h: 14, m: 45 };
  const diff = Math.abs((hour * 60 + minute) - (target.h * 60 + target.m));
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

  fastify.post("/cron", async (request, reply) => {
    if (!CRON_SECRET || request.headers.authorization !== `Bearer ${CRON_SECRET}`) {
      reply.code(401).send({ error: "unauthorized" });
      return;
    }
    const body = (request.body as any) || {};
    const runWindow: RunWindow = body.runWindow ?? runWindowFromDate(new Date());
    const runId = crypto.randomUUID();

    const regionInput = Array.isArray(body?.regions)
      ? body.regions
      : body.region
        ? [body.region]
        : undefined;

    const regions = regionInput
      ?.map((r: string) => r as RegionSlug)
      .filter((r: RegionSlug) => Boolean(REGIONS[r]));

    if (body.scheduled === true && !body.force) {
      const now = new Date();
      const inWindow = regions?.length
        ? regions.some((region: RegionSlug) => isWithinScheduledWindow(runWindow, now, REGIONS[region].timeZone))
        : isWithinScheduledWindow(runWindow, now, "America/Chicago");

      if (!inWindow) {
        reply.code(202).send({ ok: true, accepted: true, skipped: true, runWindow, runId });
        return;
      }
    }

    reply.code(202).send({ ok: true, accepted: true, runWindow, runId });
    setImmediate(() => {
      handleCron(runWindow, {
        runId,
        scheduled: body.scheduled === true,
        regions: regions?.length ? regions : undefined
      }).catch((err) => fastify.log.error(err));
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
      const runWindow: RunWindow = body.runWindow ?? runWindowFromDate(new Date());
      runAgent(agentId, body.region, runWindow).catch((err) => fastify.log.error(err));
    });
  });

  await fastify.listen({ host: "0.0.0.0", port: PORT });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
