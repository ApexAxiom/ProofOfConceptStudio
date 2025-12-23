import Fastify from "fastify";
import postsRoutes from "./routes/posts.js";
import chatRoutes from "./routes/chat.js";
import adminRoutes from "./routes/admin.js";
import healthRoutes from "./routes/health.js";

const PORT = Number(process.env.PORT ?? 3001);
const fastify = Fastify({ logger: true });

fastify.register(postsRoutes, { prefix: "/posts" });
fastify.register(chatRoutes, { prefix: "/chat" });
fastify.register(adminRoutes, { prefix: "/admin" });
fastify.register(healthRoutes, { prefix: "/health" });

fastify.listen({ host: "0.0.0.0", port: PORT }).catch((err) => {
  fastify.log.error(err);
  process.exit(1);
});
