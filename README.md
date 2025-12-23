# Category Management Intelligence Hub

Internal procurement intelligence hub with regional agents generating citation-locked briefs.

## Workspace
- pnpm workspaces
- Apps: web (Next.js), api (Fastify), runner (ingestion)

## Setup
1. Install pnpm (>=9)
2. `pnpm install`
3. Copy `.env.example` to `.env` and set values

## Scripts
- `pnpm dev` – run web, api, runner
- `pnpm run:am` – trigger AM run locally
- `pnpm run:pm` – trigger PM run locally
- `pnpm exec tsx scripts/smoke.ts` – quick end-to-end smoke (runner + api)
- `pnpm --filter runner run validate:smoke` – smoke the brief validator

## Env Vars
See `.env.example`. Secrets must be provided at runtime. Optional:
- `DDB_ENDPOINT` for local DynamoDB testing
- `CORS_ORIGINS` comma-separated allowed origins for API CORS

## AWS Deployment
- Use `infra/cloudformation/main.yml` to create DynamoDB table with GSIs.
- Deploy api/runner/web to App Runner using the provided `apprunner.yaml` files, set env vars, and wire EventBridge schedules (06:00 & 14:45 America/Chicago) to `runner` `/cron` with Bearer `CRON_SECRET`.

### App Runner configuration files
When creating App Runner services, choose **Use a configuration file**. Set the Source directory to the service folder so App Runner can find `apprunner.yaml`:
- Web: `apps/web`
- API: `apps/api`
- Runner: `apps/runner`

## App Runner Deployment (Proven Mode)
- Create three services: web, api, runner.
- Source directories: `apps/web`, `apps/api`, `apps/runner`.
- Build settings: Use configuration file (`apprunner.yaml`).
- Health check paths:
  - Web: `/api/healthz`
  - API: `/health`
  - Runner: `/healthz`
- Environment variables to set in the console or via Secrets Manager:
  - API service: `AWS_REGION`, `DDB_TABLE_NAME`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `ADMIN_TOKEN`
  - Runner: `AWS_REGION`, `DDB_TABLE_NAME`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `CRON_SECRET`
  - Web: `API_BASE_URL` (set after the API is deployed)

### Environment Variables
Shared
- `AWS_REGION`
- `DDB_TABLE_NAME` (default `CMHub`)
- `DDB_ENDPOINT` (local testing only)

API
- `PORT=8080`
- `OPENAI_API_KEY`
- `OPENAI_MODEL` (default `gpt-5.2`)
- `ADMIN_TOKEN`
- `CORS_ORIGINS` (optional)

Runner
- `PORT=8080`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `CRON_SECRET`

Web
- `PORT=8080`
- `API_BASE_URL` (URL of proof-api service)
- Web uses server-side proxy routes to call the API; set `API_BASE_URL` to the deployed api endpoint.

### Scheduler
Use EventBridge Scheduler (America/Chicago). POST to runner `/cron` with header `Authorization: Bearer <CRON_SECRET>` and bodies:
- `{ "runWindow": "am", "scheduled": true }`
- `{ "runWindow": "pm", "scheduled": true }`

### Lockfile discipline
Run `pnpm install` locally and commit `pnpm-lock.yaml` for deterministic builds. Dockerfiles will use `--frozen-lockfile` when the lockfile is present.

### Launch Checklist
- [ ] Deploy DynamoDB table via `infra/cloudformation/main.yml`
- [ ] Build and deploy App Runner services (web, api, runner) using `apprunner.yaml`
- [ ] Set required environment variables and secrets per service
- [ ] Configure EventBridge schedules for AM/PM runs
- [ ] Run `pnpm exec tsx scripts/smoke.ts` locally or against deployed endpoints

## Data Model
Single-table DynamoDB (CMHub) with GSIs on portfolio-date, region-date, status-date.

## Security
- Admin and runner endpoints require tokens.
- No secrets committed; use env vars or AWS Secrets Manager references in App Runner. Admin token is entered at runtime in the UI; do not expose via `NEXT_PUBLIC` envs.
