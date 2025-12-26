import { FastifyPluginAsync } from "fastify";

const RUNNER_BASE_URL = process.env.RUNNER_BASE_URL ?? "http://localhost:3002";

/**
 * Exposes the agent catalog from the runner service for the API tier.
 */
const agentsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/", async (request, reply) => {
    try {
      const res = await fetch(`${RUNNER_BASE_URL}/agents`);
      if (!res.ok) {
        request.log.error({ status: res.status }, "Runner /agents responded with non-200 status");
        reply.code(502).send({ error: "runner_unavailable" });
        return;
      }

      const agents = await res.json();
      return { agents };
    } catch (err) {
      request.log.error({ err }, "Failed to load agents from runner");
      reply.code(502).send({ error: "runner_unavailable" });
    }
  });
};

export default agentsRoutes;
