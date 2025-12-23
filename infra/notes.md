# Deployment Notes

## App Runner
- Build container images for `apps/api`, `apps/runner`, and `apps/web` using `pnpm install --frozen-lockfile` then `pnpm build`.
- Deploy each as an App Runner service, set environment variables: `OPENAI_API_KEY`, `OPENAI_MODEL`, `AWS_REGION`, `DDB_TABLE_NAME`, `CRON_SECRET`, `ADMIN_TOKEN`, `API_BASE_URL`, `RUNNER_BASE_URL`, `PORT`.
- Ensure each service listens on `0.0.0.0` and `process.env.PORT`.

## EventBridge
- Create two schedule rules (CST/CDT aware): 06:00 and 14:45 America/Chicago.
- Target: an HTTPS invocation of runner `/cron` with body `{ "runWindow": "am" }` or `{ "runWindow": "pm" }` and Authorization `Bearer $CRON_SECRET`.

## GitHub Actions fallback
- Workflows in `.github/workflows` call the runner endpoint using `RUNNER_BASE_URL` and secret `CRON_SECRET`.
- No secrets committed. Set repository secrets: `RUNNER_BASE_URL`, `CRON_SECRET`.
