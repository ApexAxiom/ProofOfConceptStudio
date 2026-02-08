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

### Shared
- `AWS_REGION=us-east-1`
- `DDB_TABLE_NAME=CMHub`

### API (App Runner service: api)
- `OPENAI_API_KEY` (secret)
- `OPENAI_MODEL=gpt-4o-mini` (recommended)
- `ADMIN_TOKEN` (secret)
- `RUNNER_BASE_URL=https://<runner-service>.awsapprunner.com`
- `CHAT_STATUS_VERIFY=true` (optional)
- `CHAT_STATUS_CACHE_MS=60000` (optional)

### Runner (App Runner service: runner)
- `OPENAI_API_KEY` (secret)
- `OPENAI_MODEL=gpt-4o-mini` (recommended)
- `CRON_SECRET` (secret; used to authorize `/cron` and `/run/:agentId`)
- `RUNNER_METRIC_NAMESPACE=POCStudio/Runner` (optional; CloudWatch EMF metrics namespace)

## Scheduler
Use EventBridge Scheduler to POST to runner `/cron` with:
- Header: `Authorization: Bearer <CRON_SECRET>`
- Body (APAC): `{ "runWindow": "apac", "regions": ["au"], "scheduled": true }`
- Body (International): `{ "runWindow": "international", "regions": ["us-mx-la-lng"], "scheduled": true }`

## Manual Trigger (Runner)

```bash
curl -X POST "https://<runner-service>.awsapprunner.com/cron" \
  -H "Authorization: Bearer <CRON_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"regions":["au","us-mx-la-lng"],"scheduled":false,"force":true}'
```
