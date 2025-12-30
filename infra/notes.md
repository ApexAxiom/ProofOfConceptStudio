# Deployment Notes

## App Runner
- Build container images for `apps/api`, `apps/runner`, and `apps/web` using `pnpm install --frozen-lockfile` then `pnpm build`.
- Deploy each as an App Runner service, set environment variables: `OPENAI_API_KEY`, `OPENAI_MODEL`, `AWS_REGION`, `DDB_TABLE_NAME`, `CRON_SECRET`, `ADMIN_TOKEN`, `API_BASE_URL`, `RUNNER_BASE_URL`, `PORT`.
- Ensure each service listens on `0.0.0.0` and `process.env.PORT`.

## EventBridge
- Create regional schedules:
  - APAC: 06:00 Australia/Perth (22:00 UTC prior day) -> body `{ "runWindow": "apac", "regions": ["au"], "scheduled": true }`.
  - International: 06:00 America/Chicago (11:00/12:00 UTC for DST coverage) -> body `{ "runWindow": "international", "regions": ["us-mx-la-lng"], "scheduled": true }`.
- Target: HTTPS invocation of runner `/cron` with Authorization `Bearer $CRON_SECRET`.

## GitHub Actions fallback
- Workflows in `.github/workflows` call the runner endpoint using `RUNNER_BASE_URL` and secret `CRON_SECRET`.
- No secrets committed. Set repository secrets: `RUNNER_BASE_URL`, `CRON_SECRET`.
