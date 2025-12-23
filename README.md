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

## Env Vars
See `.env.example`. Secrets must be provided at runtime.

## AWS Deployment
- Use `infra/cloudformation/main.yml` to create DynamoDB table with GSIs.
- Deploy api/runner/web to App Runner, set env vars, and wire EventBridge schedules (06:00 & 14:45 America/Chicago) to `runner` `/cron` with Bearer `CRON_SECRET`.

## Data Model
Single-table DynamoDB (CMHub) with GSIs on portfolio-date, region-date, status-date.

## Security
- Admin and runner endpoints require tokens.
- No secrets committed; use env vars or AWS Secrets Manager references in App Runner.
