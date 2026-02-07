import Fastify from "fastify";
import cors from "@fastify/cors";
import postsRoutes from "./routes/posts.js";
import chatRoutes from "./routes/chat.js";
import adminRoutes from "./routes/admin.js";
import healthRoutes from "./routes/health.js";
import agentsRoutes from "./routes/agents.js";
import { initializeSecrets } from "./lib/secrets.js";

async function main() {
  // Load secrets from AWS Secrets Manager before starting the server
  await initializeSecrets();

  console.log("AI configuration", {
    openaiKeyPresent: Boolean(process.env.OPENAI_API_KEY),
    model: process.env.OPENAI_MODEL ?? "gpt-4o",
    runnerBaseUrlPresent: Boolean(process.env.RUNNER_BASE_URL)
  });

const PORT = Number(process.env.PORT ?? 3001);
  const fastify = Fastify({ logger: true });

  const origins = process.env.CORS_ORIGINS?.split(",").map((o) => o.trim()).filter(Boolean) ?? [];
  fastify.register(cors, {
    origin: origins.length > 0 ? origins : process.env.NODE_ENV === "development"
  });

  fastify.register(postsRoutes, { prefix: "/posts" });
  fastify.register(chatRoutes, { prefix: "/chat" });
  fastify.register(adminRoutes, { prefix: "/admin" });
  fastify.register(agentsRoutes, { prefix: "/agents" });
  fastify.register(healthRoutes, { prefix: "/health" });

  await fastify.listen({ host: "0.0.0.0", port: PORT });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
