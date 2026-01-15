# Category Management Intelligence Hub

Internal procurement intelligence hub with regional agents generating citation-locked briefs.

## Workspace
- pnpm workspaces
- Apps: web (Next.js), api (Fastify), runner (ingestion)

## Documentation
- [Verified source directory](docs/sources/README.md) – reachability-checked source list for briefs.

## Setup
1. Install pnpm (>=9)
2. `pnpm install`
3. Copy `.env.example` to `.env` and set values

## Scripts
- `pnpm dev` – run web, api, runner
- `pnpm run:apac` – trigger APAC run locally
- `pnpm run:international` – trigger International run locally
- `pnpm exec tsx scripts/smoke.ts` – quick end-to-end smoke (runner + api)
- `pnpm --filter runner run validate:smoke` – smoke the brief validator
- `pnpm --filter runner run render:smoke` – smoke-test markdown rendering

## Env Vars
See `.env.example`. Secrets must be provided at runtime. Optional:
- `DDB_ENDPOINT` for local DynamoDB testing
- `CORS_ORIGINS` comma-separated allowed origins for API CORS
- `BING_IMAGE_KEY`/`BING_IMAGE_ENDPOINT` for optional Bing image fallback when scraping article images

## AWS Deployment
- Use `infra/cloudformation/main.yml` to create DynamoDB table with GSIs.
- Deploy api/runner/web to App Runner using the provided `apprunner.yaml` files, set env vars, and wire EventBridge schedules to `runner` `/cron` with Bearer `CRON_SECRET`.
  - APAC: 06:00 Australia/Perth (22:00 UTC prior day) with body `{ "runWindow": "apac", "regions": ["au"], "scheduled": true }`.
  - International: 06:00 America/Chicago (11:00/12:00 UTC) with body `{ "runWindow": "international", "regions": ["us-mx-la-lng"], "scheduled": true }`.

### App Runner configuration files
When creating App Runner services, choose **Use a configuration file**. Set the Source directory to the service folder so App Runner can find `apprunner.yaml`:
- Web: `apps/web`
- API: `apps/api`
- Runner: `apps/runner`

Each service directory must include its own `apprunner.yaml`, and the App Runner **Source directory** should always match the corresponding app folder (for example `apps/web`). Pointing App Runner at the repo root will not work.

### Proven App Runner Setup
- App Runner installs without npm workspaces; internal packages use `file:` links (for example `@proof/shared: "file:../../packages/shared"`).
- Select **Source code repository** + **Use configuration file** and point to the service directory so App Runner picks up `apprunner.yaml`.
- Ports honor `PORT` (default 8080) and bind `0.0.0.0`. Health checks:
  - Web: Source `apps/web`, config `apps/web/apprunner.yaml`, health path `/api/healthz`.
  - API: Source `apps/api`, config `apps/api/apprunner.yaml`, health path `/health`.
  - Runner: Source `apps/runner`, config `apps/runner/apprunner.yaml`, health path `/healthz`.

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
- `OPENAI_MODEL` (default `gpt-4o`; set explicitly for production quality)
- `ADMIN_TOKEN`
- `CORS_ORIGINS` (optional)

Runner
- `PORT=8080`
- `OPENAI_API_KEY`
- `OPENAI_MODEL` (default `gpt-4o`; prefer an explicit value for consistent briefs)
- `CRON_SECRET`

Web
- `PORT=8080`
- `API_BASE_URL` (URL of proof-api service)
- Web uses server-side proxy routes to call the API; set `API_BASE_URL` to the deployed api endpoint.

### Scheduler
Use EventBridge Scheduler with region-specific times. POST to runner `/cron` with header `Authorization: Bearer <CRON_SECRET>`:
- APAC (06:00 Australia/Perth): `{ "runWindow": "apac", "regions": ["au"], "scheduled": true }`
- International (06:00 America/Chicago): `{ "runWindow": "international", "regions": ["us-mx-la-lng"], "scheduled": true }`

### Lockfile discipline
Run `pnpm install` locally and commit `pnpm-lock.yaml` for deterministic builds. Dockerfiles will use `--frozen-lockfile` when the lockfile is present.

### Launch Checklist
- [ ] Deploy DynamoDB table via `infra/cloudformation/main.yml`
- [ ] Build and deploy App Runner services (web, api, runner) using `apprunner.yaml`
- [ ] Set required environment variables and secrets per service
- [ ] Configure EventBridge schedules for APAC (06:00 Perth) and International (06:00 Chicago) runs
- [ ] Run `pnpm exec tsx scripts/smoke.ts` locally or against deployed endpoints

## Data Model
Single-table DynamoDB (CMHub) with GSIs on portfolio-date, region-date, status-date.

## Market Dashboard Portfolio
- Portfolio slug: `market-dashboard` (Oil & Gas / LNG Market Dashboard)
- Mode: cross-category dashboard that aggregates recently published category briefs per region to produce an executive market overview and procurement actions.

## Images
- Article and hero images are scraped directly from source pages (OpenGraph/Twitter/meta + prominent content images) with realistic browser headers.
- The web app proxies images through `/api/image-proxy` using a Chrome-like user agent with a retry that drops the referer when needed.

## AWS Secrets Manager Integration

The API and runner services support loading secrets from AWS Secrets Manager at startup. This is optional but recommended for production deployments.

### Configuration
Set the `AWS_SECRET_NAME` environment variable to enable fetching secrets from AWS Secrets Manager:

```bash
AWS_SECRET_NAME=daily-briefs/app-secrets
AWS_REGION=us-east-1
SECRETS_CACHE_TTL_MS=300000  # Optional: cache TTL in ms (default: 5 minutes)
```

### Secret Format
Create a secret in AWS Secrets Manager as a JSON object with keys matching the environment variables:

```json
{
  "OPENAI_API_KEY": "sk-...",
  "CRON_SECRET": "your-cron-secret",
  "ADMIN_TOKEN": "your-admin-token",
  "DDB_TABLE_NAME": "CMHub",
  "API_BASE_URL": "https://your-api.awsapprunner.com",
  "RUNNER_BASE_URL": "https://your-runner.awsapprunner.com"
}
```

### Behavior
- Secrets from AWS Secrets Manager are merged with environment variables at startup
- Environment variables take precedence over secrets (allows local overrides)
- If `AWS_SECRET_NAME` is not set, the services fall back to environment variables only
- Secrets are cached for 5 minutes by default to reduce API calls

### Required IAM Permissions
The App Runner instance role needs permission to read the secret:

```json
{
  "Effect": "Allow",
  "Action": ["secretsmanager:GetSecretValue"],
  "Resource": "arn:aws:secretsmanager:us-east-1:ACCOUNT_ID:secret:daily-briefs/app-secrets-*"
}
```

## Security
- Admin and runner endpoints require tokens.
- No secrets committed; use env vars or AWS Secrets Manager references in App Runner. Admin token is entered at runtime in the UI; do not expose via `NEXT_PUBLIC` envs.
- Upgrade Next.js promptly when security advisories are published and move to patched 15.0.x releases as needed.

