import { FastifyPluginAsync } from "fastify";
import { REGION_LIST } from "@proof/shared";
import { filterPosts, getPost, getRegionPosts, latestPerPortfolio } from "../db/posts.js";


function canIncludeHidden(request: { headers: Record<string, unknown> }, includeHidden?: string): boolean {
  if (includeHidden !== "true") return false;
  const token = process.env.ADMIN_DEBUG_TOKEN?.trim();
  if (!token) return false;
  const header = String(request.headers["x-admin-token"] ?? "").trim();
  return header.length > 0 && header === token;
}

const postsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/", async (request, reply) => {
    const { region, portfolio, runWindow, limit, includeHidden } = request.query as Record<string, string>;
    const validRegions = new Set<string>(REGION_LIST.map((r) => r.slug));
    if (!region || !validRegions.has(region)) {
      reply.code(400).send({ error: "region is required and must be a valid RegionSlug" });
      return;
    }
    return filterPosts({
      region,
      portfolio,
      runWindow,
      limit: limit ? Number(limit) : 20,
      includeHidden: canIncludeHidden(request as any, includeHidden)
    });
  });

  fastify.get("/latest", async (request, reply) => {
    const { region, includeHidden } = request.query as Record<string, string>;
    const validRegions = new Set<string>(REGION_LIST.map((r) => r.slug));
    if (!region || !validRegions.has(region)) {
      reply.code(400).send({ error: "region is required and must be a valid RegionSlug" });
      return;
    }
    return getRegionPosts(region, 120, canIncludeHidden(request as any, includeHidden)).then((posts) => posts.slice(0, 30));
  });

  fastify.get("/latest-by-portfolio", async (request, reply) => {
    const { region, includeHidden } = request.query as Record<string, string>;
    const validRegions = new Set<string>(REGION_LIST.map((r) => r.slug));
    if (!region || !validRegions.has(region)) {
      reply.code(400).send({ error: "region is required and must be a valid RegionSlug" });
      return;
    }
    const posts = await getRegionPosts(region, 800, canIncludeHidden(request as any, includeHidden));
    return latestPerPortfolio(posts);
  });

  fastify.get<{ Params: { postId: string } }>("/:postId", async (request, reply) => {
    const { postId } = request.params;
    const post = await getPost(postId);
    if (!post) {
      reply.code(404).send({ error: "Post not found", postId });
      return;
    }
    return post;
  });
};

export default postsRoutes;
