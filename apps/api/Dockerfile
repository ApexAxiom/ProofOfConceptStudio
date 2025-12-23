FROM node:20-slim AS builder
WORKDIR /app
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable

COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages
COPY infra ./infra

# Copy lockfile if present for deterministic installs
COPY pnpm-lock.yaml ./ 2>/dev/null || true

RUN if [ -f pnpm-lock.yaml ]; then pnpm install --frozen-lockfile; else pnpm install; fi
RUN pnpm --filter @proof/api... build

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable

COPY --from=builder /app /app

EXPOSE 3001
CMD ["node", "apps/api/dist/server.js"]
