# Amplify Migration Plan

## Goal
Move the user-facing web tier to Amplify Hosting, remove the runner from the chat request path, then replace the remaining always-on App Runner services with event-driven components where that reduces cost without regressing scheduled brief generation.

## Current State
- `apps/web` is a Next.js 15 app deployed on App Runner.
- `apps/api` is a Fastify service deployed on App Runner.
- `apps/runner` is a Fastify service deployed on App Runner and handles `/agents`, `/cron`, and `/run/:agentId`.
- Chat currently depends on runner metadata for agent resolution.
- Scheduled brief generation is triggered over HTTP into the runner.

## Target State
- `apps/web` runs on Amplify Hosting.
- Chat and agent lookup do not require a live runner service.
- The runner becomes scheduled/orchestrated compute instead of an always-on web service.
- Admin-triggered runs use event-driven orchestration with explicit status tracking.

## Phase 0: Stabilize The Cut Line
Completed in this tranche:
- Add `amplify.yml` for `apps/web`.
- Add a build-time env writer for Amplify SSR runtime variables.
- Generate a shared local agent catalog from `apps/runner/src/agents/agents.yaml`.
- Move API agent resolution off runner `/agents`.

Exit criteria:
- `apps/web` can build in Amplify against an existing App Runner API.
- `apps/api` can resolve agents with no runner `/agents` dependency.

Rollback:
- Repoint Amplify traffic away from the app and continue serving web from App Runner.
- Revert the shared catalog changes and restore the API fetch to runner `/agents`.

## Phase 1: Deploy Web On Amplify
Tasks:
1. Create an Amplify app pointed at this repository with app root `apps/web`.
2. Set Amplify environment variables:
   - `API_BASE_URL`
   - `CHAT_PROXY_TIMEOUT_MS`
   - `CHAT_ADMIN_USERNAME`
   - `CHAT_ADMIN_PASSWORD`
   - `AWS_SECRET_NAME` if web must read Secrets Manager directly
   - `AWS_REGION`
   - `SECRETS_CACHE_TTL_MS`
   - `EXECUTIVE_GOOGLE_NEWS_ENABLED`
   - `GOOGLE_NEWS_ENABLED`
3. Connect the custom domain to Amplify.
4. Keep `apps/api` and `apps/runner` on App Runner for the initial cutover.

Validation:
- Home page, region pages, portfolio pages, brief detail pages, and chat UI render in Amplify.
- `GET /api/healthz`, `GET /api/agents`, and `POST /api/chat` succeed through the Amplify-hosted app.
- Chat works end-to-end against the existing App Runner API.

Rollback:
- Repoint DNS back to the App Runner web service.
- No data rollback is required.

## Phase 2: Collapse API Into The Next.js App
Tasks:
1. Extract `apps/api/src/routes/*` business logic into shared server modules that can be called from both Fastify and Next route handlers.
2. Re-implement the current API surface in `apps/web/src/app/api/*` without proxying to `API_BASE_URL`.
3. Move DynamoDB, OpenAI, and admin auth logic into the shared server modules.
4. Keep the existing JSON contract unchanged so the frontend does not need to move at the same time.
5. Remove `API_BASE_URL` from the required production config once cutover is complete.

Recommended order:
1. `/agents`
2. `/posts`
3. `/chat`
4. `/admin/briefs`
5. `/admin/run-status`
6. `/admin/feed-health`
7. `/admin/run`

Validation:
- The existing frontend works against the in-app routes with no code changes.
- Chat latency remains acceptable under Amplify SSR.
- Admin endpoints still enforce `ADMIN_TOKEN`.

Rollback:
- Re-enable proxying to the App Runner API by restoring `API_BASE_URL`.

## Phase 3: Replace The Runner HTTP Service
Tasks:
1. Split the runner into:
   - scheduled entrypoint
   - orchestration layer
   - per-agent execution unit
   - status/event persistence
2. Replace HTTP `/cron` scheduling with EventBridge Scheduler -> Step Functions.
3. Invoke one Lambda per agent or one Lambda per batch, depending on runtime.
4. If any agent or batch regularly approaches the 900-second Lambda limit, switch that step to ECS/Fargate instead of Lambda.
5. Keep DynamoDB as the source of truth for published briefs and run status.
6. Preserve the current coverage audit, retry, and fallback publication behavior from `apps/runner/src/run.ts`.

Recommended AWS shape:
- EventBridge Scheduler for region schedules
- Step Functions Standard for orchestration, retries, and fan-out
- Lambda for catalog lookup, ingestion, generation, validation, and lightweight publish paths
- ECS/Fargate only for workloads that exceed Lambda limits in practice

Validation:
- APAC and International schedules publish the expected briefs.
- Coverage audit and fallback publication still run.
- Admin-triggered runs create traceable execution records.

Rollback:
- Leave the App Runner runner service alive until the Step Functions path has multiple successful days.
- If needed, switch schedules back to the HTTP runner endpoint.

## Phase 4: Remove Legacy App Runner Services
Tasks:
1. Decommission the App Runner web service after Amplify is stable.
2. Decommission the App Runner API after all API routes live inside `apps/web`.
3. Decommission the App Runner runner after the scheduled workflow replacement is stable.
4. Remove obsolete env vars and deployment docs.

Validation:
- Only Amplify Hosting plus event-driven backend resources remain in the runtime path.
- Monthly App Runner spend is reduced to zero or to the small subset intentionally retained.

## Repo Workstreams
### Web
- Keep `apps/web` deployable as a standalone Amplify target.
- Replace proxy routes with native route handlers in Phase 2.

### Shared
- Keep agent catalog logic in `packages/shared` so web, api, and runner use the same source.
- Regenerate the catalog whenever `apps/runner/src/agents/agents.yaml` changes.

### API
- Treat the current Fastify app as a compatibility shell until logic is fully extracted.
- Remove runner `/agents` dependency first.

### Runner
- Preserve current generation behavior while changing the execution model underneath it.
- Do not change category mapping or agent prompts during migration.

## Testing Checklist
- `pnpm --filter runner run generate:agent-catalog`
- `pnpm --filter @proof/shared build`
- `pnpm --filter @proof/api build`
- `pnpm --filter @proof/web build`
- `pnpm smoke:core`
- Manual chat smoke through the deployed Amplify domain
- Manual admin run smoke against the remaining runner path

## Open Risks
- Long-running generation flows may exceed Lambda limits; benchmark before committing to a Lambda-only runner.
- Amplify SSR env vars must be written into `.env.production` during build for server-side route handlers.
- The current runner admin endpoints still require a live runner service until Phase 3 is complete.

## Immediate Next Steps
1. Deploy `apps/web` to Amplify with the new `amplify.yml`.
2. Validate the hybrid topology: Amplify web + App Runner API + App Runner runner.
3. Start extracting `/posts` and `/chat` API logic into shared server modules.
