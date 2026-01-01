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

## GitHub Actions Daily Briefs Workflow

The `.github/workflows/daily-briefs.yml` workflow provides automated brief generation via GitHub Actions, serving as either a primary scheduler or fallback to EventBridge.

### Required Repository Secrets

Configure these in GitHub → Repository → Settings → Secrets and variables → Actions:

| Secret | Description | How to obtain |
|--------|-------------|---------------|
| `RUNNER_BASE_URL` | Full URL of the deployed runner App Runner service | Copy from AWS App Runner console after deploying the runner service |
| `CRON_SECRET` | Bearer token for authenticating to the runner's `/cron` endpoint | Must match the `CRON_SECRET` environment variable set in the runner service |

### Troubleshooting

If the workflow fails with "RUNNER_BASE_URL secret is not configured":
1. Ensure both secrets are added to the repository (not organization-level unless scoped correctly)
2. Verify the runner service is deployed and accessible
3. Check that the CRON_SECRET matches between GitHub secrets and the runner's environment

### Schedule Details

- **APAC**: `0 22 * * *` UTC (06:00 next day Australia/Perth)
- **International Early**: `0 11 * * *` UTC (covers 06:00 America/Chicago during CDT)
- **International Late**: `0 12 * * *` UTC (covers 06:00 America/Chicago during CST)

The workflow uses a matrix strategy to run the appropriate jobs based on schedule matching.
