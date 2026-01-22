# Deployment Notes

## App Runner
- Build container images for `apps/api`, `apps/runner`, and `apps/web` using `pnpm install --frozen-lockfile` then `pnpm build`.
- Deploy each as an App Runner service, set environment variables: `OPENAI_API_KEY`, `OPENAI_MODEL`, `AWS_REGION`, `DDB_TABLE_NAME`, `CRON_SECRET`, `ADMIN_TOKEN`, `API_BASE_URL`, `RUNNER_BASE_URL`, `PORT`.
- Ensure each service listens on `0.0.0.0` and `process.env.PORT`.

## EventBridge
- Create regional schedules:
  - APAC: 06:00 AM AWST -> body `{ "runWindow": "apac", "regions": ["au"], "scheduled": true }`.
  - International: 06:00 AM CST -> body `{ "runWindow": "international", "regions": ["us-mx-la-lng"], "scheduled": true }`.
- Target: HTTPS invocation of runner `/cron` with Authorization `Bearer $CRON_SECRET`.

