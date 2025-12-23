import Fastify from "fastify";
import { runWindowFromDate, type RunWindow } from "@proof/shared";
import { handleCron, runAgent } from "./run.js";
import { v4 as uuidv4 } from "uuid";

const PORT = Number(process.env.PORT ?? 3002);
const CRON_SECRET = process.env.CRON_SECRET ?? "";

const fastify = Fastify({ logger: true });

fastify.get("/health", async () => ({ status: "ok" }));
fastify.get("/healthz", async () => ({ status: "ok" }));

function isWithinScheduledWindow(runWindow: RunWindow, now: Date, toleranceMinutes = 10): boolean {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
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

fastify.post("/cron", async (request, reply) => {
  if (!CRON_SECRET || request.headers.authorization !== `Bearer ${CRON_SECRET}`) {
    reply.code(401).send({ error: "unauthorized" });
    return;
  }
  const body = (request.body as any) || {};
  const runWindow: RunWindow = body.runWindow ?? runWindowFromDate(new Date());
  const runId = uuidv4();

  if (body.scheduled === true && !body.force && !isWithinScheduledWindow(runWindow, new Date())) {
    reply.code(202).send({ ok: true, accepted: true, skipped: true, runWindow, runId });
    return;
  }

  reply.code(202).send({ ok: true, accepted: true, runWindow, runId });
  setImmediate(() => {
    handleCron(runWindow, { runId, scheduled: body.scheduled === true }).catch((err) =>
      fastify.log.error(err)
    );
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

fastify.listen({ host: "0.0.0.0", port: PORT }).catch((err) => {
  fastify.log.error(err);
  process.exit(1);
});
