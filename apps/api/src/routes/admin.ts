import { FastifyPluginAsync } from "fastify";
import { runWindowForRegion, RegionSlug } from "@proof/shared";

const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? "";
const RUNNER_BASE_URL = process.env.RUNNER_BASE_URL ?? "http://localhost:3002";

const adminRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", async (request, reply) => {
    const token = request.headers["x-admin-token"] || request.headers.authorization?.replace("Bearer ", "");
    if (!ADMIN_TOKEN || token !== ADMIN_TOKEN) {
      reply.code(401).send({ error: "unauthorized" });
      return;
    }
  });

  fastify.post("/run", async (request) => {
    const body = request.body as any;
    const region = (body.region as RegionSlug) ?? "us-mx-la-lng";
    const runWindow = body.runWindow || runWindowForRegion(region);
    const agentId = body.agentId;
    const url = agentId
      ? `${RUNNER_BASE_URL}/run/${agentId}`
      : `${RUNNER_BASE_URL}/cron`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.CRON_SECRET}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ runWindow, region })
    });
    const json = await res.json();
    return json;
  });
};

export default adminRoutes;
