# Deployment Configuration (Template)

This doc is a **template** for recording deployment endpoints and required environment variables for POCStudio services.

Do **not** commit real secrets (OpenAI keys, admin tokens, cron secrets) to git. Store them in:
- AWS App Runner environment variables, or
- AWS Secrets Manager (recommended), referenced by `AWS_SECRET_NAME`.

## Service URLs
Fill these in from the AWS App Runner console:
- API Service: `https://<api-service>.awsapprunner.com`
- Runner Service: `https://<runner-service>.awsapprunner.com`
- Web Service: `https://<web-service>.awsapprunner.com`

## Environment Variables

**OPENAI_API_KEY is not shared between services.** Each App Runner service has its own environment. You must set `OPENAI_API_KEY` in **both** the API and Runner services (same value is fine; configure it in each service’s environment in the AWS console).

| Service | OPENAI_API_KEY used for |
|---------|-------------------------|
| **API** (`pocstudio-api`) | Chat AI responses |
| **Runner** (runner App Runner service) | Brief generation (cron runs) |

If the Runner does not have `OPENAI_API_KEY` set, scheduled brief runs will fail with "OPENAI_API_KEY is not configured" and no new briefs will be published.

### Shared
- `AWS_REGION=us-east-1`
- `DDB_TABLE_NAME=CMHub`

### API (App Runner service: e.g. `pocstudio-api`)
- `OPENAI_API_KEY` (secret) — **required for chat**
- `OPENAI_MODEL=gpt-4o-mini` (recommended)
- `ADMIN_TOKEN` (secret)
- `RUNNER_BASE_URL=https://<runner-service>.awsapprunner.com`
- `CHAT_STATUS_VERIFY=true` (optional)
- `CHAT_STATUS_CACHE_MS=60000` (optional)

### Runner (App Runner service: e.g. runner at `pe8rz3uzip...`)
- `OPENAI_API_KEY` (secret) — **required for brief generation** (set in Runner’s env; not linked from API)
- `OPENAI_MODEL=gpt-4o-mini` (recommended)
- `CRON_SECRET` (secret; used to authorize `/cron` and `/run/:agentId`)
- `RUNNER_METRIC_NAMESPACE=POCStudio/Runner` (optional; CloudWatch EMF metrics namespace)

## Scheduler
Use EventBridge Scheduler to POST to runner `/cron` with:
- Header: `Authorization: Bearer <CRON_SECRET>`
- APAC: Tuesday/Thursday at 06:00 Australia/Perth, three batches at 0/10/20 minutes.
  - Body: `{ "runWindow": "apac", "regions": ["au"], "scheduled": true, "batchIndex": 0, "batchCount": 3 }`
- International: Tuesday/Thursday at 05:00 America/Chicago, three batches at 0/10/20 minutes.
  - Body: `{ "runWindow": "international", "regions": ["us-mx-la-lng"], "scheduled": true, "batchIndex": 0, "batchCount": 3 }`

Scheduled non-force, non-dry-run requests outside Tuesday/Thursday local time are accepted as a truthful skip:
`{ "ok": true, "skipped": true, "reason": "scheduled_runs_only_tuesday_thursday" }`.

Schedule the runner `/scheduled-health` endpoint daily after each regional run window:
- APAC: 09:00 Australia/Perth with `{ "runWindow": "apac", "regions": ["au"] }`
- International: 08:00 America/Chicago with `{ "runWindow": "international", "regions": ["us-mx-la-lng"] }`

The health check emits `ExpectedRunCompleted` and `ExpectedBriefPublished` as `1` on normal off-days, and as `0` only when a Tuesday/Thursday expected run window did not complete or publish.

## Manual Trigger (Runner)

```bash
curl -X POST "https://<runner-service>.awsapprunner.com/cron" \
  -H "Authorization: Bearer <CRON_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"regions":["au","us-mx-la-lng"],"scheduled":false,"force":true}'
```
