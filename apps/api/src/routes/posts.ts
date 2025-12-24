import { FastifyPluginAsync } from "fastify";
import { REGION_LIST } from "@proof/shared";
import { filterPosts, getPost, getRegionPosts } from "../db/posts.js";

const postsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/", async (request, reply) => {
    const { region, portfolio, runWindow, limit } = request.query as Record<string, string>;
    const validRegions = new Set<string>(REGION_LIST.map((r) => r.slug));
    if (!region || !validRegions.has(region)) {
      reply.code(400).send({ error: "region is required and must be a valid RegionSlug" });
      return;
    }
    return filterPosts({ region, portfolio, runWindow, limit: limit ? Number(limit) : 20 });
  });

  fastify.get("/latest", async (request, reply) => {
    const { region } = request.query as Record<string, string>;
    const validRegions = new Set<string>(REGION_LIST.map((r) => r.slug));
    if (!region || !validRegions.has(region)) {
      reply.code(400).send({ error: "region is required and must be a valid RegionSlug" });
      return;
    }
    return getRegionPosts(region).then((posts) => posts.slice(0, 30));
  });

  fastify.get<{ Params: { postId: string } }>("/:postId", async (request) => {
    const { postId } = request.params;
    return getPost(postId);
  });
};

export default postsRoutes;
