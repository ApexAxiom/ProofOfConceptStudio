import { FastifyPluginAsync } from "fastify";
import { listAgentSummaries } from "@proof/shared";

/**
 * Exposes the agent catalog from the shared registry so chat does not depend on a live runner service.
 */
const agentsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/", async () => {
    return {
      agents: listAgentSummaries({ includeFeeds: true })
    };
  });
};

export default agentsRoutes;
