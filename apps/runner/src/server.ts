import Fastify from "fastify";
import { runWindowFromDate, type RunWindow } from "@proof/shared";
import { handleCron, runAgent } from "./run.js";

const PORT = Number(process.env.PORT ?? 3002);
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
  await handleCron(runWindow);
  return { ok: true, runWindow };
});

fastify.post<{ Params: { agentId: string } }>("/run/:agentId", async (request, reply) => {
  if (!CRON_SECRET || request.headers.authorization !== `Bearer ${CRON_SECRET}`) {
    reply.code(401).send({ error: "unauthorized" });
    return;
  }
  const { agentId } = request.params;
  const body = (request.body as any) || {};
  await runAgent(agentId, body.region, body.runWindow);
  return { ok: true };
});

fastify.listen({ host: "0.0.0.0", port: PORT }).catch((err) => {
  fastify.log.error(err);
  process.exit(1);
});
