import { FastifyPluginAsync } from "fastify";

const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/", async () => ({ status: "ok" }));
  fastify.get("/healthz", async () => ({ status: "ok" }));
};

export default healthRoutes;
