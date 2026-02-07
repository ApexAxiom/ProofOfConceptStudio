import { FastifyPluginAsync } from "fastify";
import { getAdminToken, getCronSecret, runWindowForRegion, RegionSlug } from "@proof/shared";
import { fetchRunStatus } from "../db/run-status.js";

const ADMIN_TOKEN = getAdminToken();
const RUNNER_BASE_URL = process.env.RUNNER_BASE_URL ?? "http://localhost:3002";

const adminRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", async (request, reply) => {
    const token = request.headers["x-admin-token"] || request.headers.authorization?.replace("Bearer ", "");
    if (!ADMIN_TOKEN || token !== ADMIN_TOKEN) {
      reply.code(401).send({ error: "unauthorized" });
      return;
    }
  });

  fastify.post("/run", async (request, reply) => {
    const body = request.body as any;
    const agentId = body.agentId;
    const force = body.force === true;
    const parsedBatchSize = Number(body.batchSize);
    const batchSize = Number.isFinite(parsedBatchSize) && parsedBatchSize > 0 ? Math.floor(parsedBatchSize) : undefined;

    if (agentId) {
      const region = (body.region as RegionSlug) ?? "us-mx-la-lng";
      const runWindow = body.runWindow || runWindowForRegion(region);
      const runDate = typeof body.runDate === "string" ? body.runDate : undefined;
      const dryRun = body.dryRun === true;
      const res = await fetch(`${RUNNER_BASE_URL}/run/${agentId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getCronSecret()}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ runWindow, region, runDate, dryRun })
      });
      const json = await res.json();
      return reply.status(res.status).send(json);
    }

    const regions = Array.isArray(body.regions) ? body.regions : undefined;
    const region = (body.region as RegionSlug) ?? "us-mx-la-lng";
    const runWindow = body.runWindow || runWindowForRegion(region);
    const payload: Record<string, unknown> = { force };
    if (batchSize) {
      payload.batchSize = batchSize;
    } else if (!agentId) {
      payload.batchSize = 3;
    }
    if (Number.isInteger(body.batchIndex)) payload.batchIndex = Number(body.batchIndex);
    if (Number.isInteger(body.batchCount)) payload.batchCount = Number(body.batchCount);
    if (Array.isArray(body.agentIds)) payload.agentIds = body.agentIds;
    if (regions?.length) {
      payload.regions = regions;
    } else {
      payload.region = region;
      payload.runWindow = runWindow;
    }
    if (typeof body.runDate === "string") {
      payload.runDate = body.runDate;
    }
    if (body.dryRun === true) {
      payload.dryRun = true;
    }

    const res = await fetch(`${RUNNER_BASE_URL}/cron`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getCronSecret()}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    return reply.status(res.status).send(json);
  });

  fastify.get("/feed-health", async (request, reply) => {
    const limitRaw = Number((request.query as { limit?: string | number })?.limit ?? 200);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.floor(limitRaw) : 200;
    const res = await fetch(`${RUNNER_BASE_URL}/feed-health?limit=${limit}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${getCronSecret()}`,
        "Content-Type": "application/json"
      }
    });
    const json = await res.json();
    return reply.status(res.status).send(json);
  });

  fastify.get("/run-status", async (request) => {
    const query = request.query as { region?: RegionSlug; briefDay?: string; limit?: string };
    const region = query.region ?? "us-mx-la-lng";
    const limitRaw = Number(query.limit ?? 200);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.floor(limitRaw) : 200;
    return fetchRunStatus({
      region,
      briefDay: query.briefDay,
      limit
    });
  });
};

export default adminRoutes;
