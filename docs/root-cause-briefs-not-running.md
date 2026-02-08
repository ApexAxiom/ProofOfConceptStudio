# Root Cause: Briefs Not Running / No New Articles

## Summary

1. **EventBridge / Scheduler** – Scheduler *did* fire on some days (e.g. 2026-02-04); runs were executed but many **AU (APAC)** briefs **failed validation** and were saved as draft/failed, so no new *published* briefs for those categories.
2. **Validation blocking AU** – Factuality checks (evidence tags, numeric claims) were strict; issues like "not found exactly in articleIndex … (approximate match allowed)" were treated as **blocking**, so briefs were not published.
3. **Lambda proxy** – If you use the Lambda proxy (`briefs-cron-proxy`), secret parsing could fail if the secret was not JSON; timeout was default (3s). Both are now hardened.

## Fixes Applied

### 1. EventBridge Lambda proxy (if you use `scheduler-lambda.yml`)

- **Secret parsing**: Accepts both JSON `{"CRON_SECRET": "…"}` and plain-string secret.
- **Timeout**: Set to 30s so the Lambda has time to call the runner.
- **Logging**: Logs response and errors to CloudWatch for easier debugging.

Redeploy to apply:

```bash
cd infra/eventbridge
# Update parameters as needed, then:
aws cloudformation deploy --template-file scheduler-lambda.yml --stack-name briefs-scheduler-lambda \
  --parameter-overrides RunnerBaseUrl=<RUNNER_URL> SecretArn=<SECRET_ARN> --capabilities CAPABILITY_IAM --region us-east-1
```

### 2. Validation: approximate-match issues non-blocking

- In `apps/runner/src/run.ts`, factuality issues that contain **"(approximate match allowed)"** are now treated as **warnings** (logged but **do not block** publication).
- This allows briefs to publish when the only problems are numeric near-matches; stricter issues (e.g. missing evidence tags) still block.

### 3. Manual trigger and diagnostics

- **Trigger a run** (catch-up when EventBridge didn’t fire or for testing):

  ```bash
  RUNNER_BASE_URL=https://<runner-url> CRON_SECRET=<secret> pnpm exec tsx scripts/trigger-brief-run.ts run
  ```

  Optional: add `--wait` to wait for completion.

- **Check scheduler and diagnostics**:

  ```bash
  pnpm exec tsx scripts/trigger-brief-run.ts check
  ```

  This checks EventBridge Scheduler execution and runs `diagnose-missing-briefs.ts` (requires AWS credentials and `DDB_TABLE_NAME`).

### 4. Runner agents.yaml path

- `loadAgents()` in `apps/runner/src/agents/config.ts` now resolves `agents.yaml` relative to the config file (`import.meta.url`), so scripts (e.g. `diagnose-missing-briefs.ts`) work when run from the repo root.

## What You Should Do

1. **Redeploy Lambda** (if you use the Lambda proxy) so the new secret parsing and timeout are in effect.
2. **Run a manual catch-up**:
   - Either: `RUNNER_BASE_URL=... CRON_SECRET=... pnpm exec tsx scripts/trigger-brief-run.ts run`
   - Or via API: `API_BASE_URL=... ADMIN_TOKEN=... pnpm run run-briefs all`
3. **Re-run diagnostics** after the run:
   - `pnpm exec tsx scripts/trigger-brief-run.ts check`
   - Or: `pnpm exec tsx scripts/diagnose-missing-briefs.ts`
4. If AU briefs still don’t publish, check failed run logs for remaining **blocking** validation issues (e.g. "missing an evidence tag", "Brief must have at least one source") and address those in prompts or validation logic.

## References

- `JAN21_INVESTIGATION.md` – EventBridge Scheduler did not invoke Lambda on Jan 21.
- `DIAGNOSIS_MISSING_BRIEFS.md` – General diagnosis steps.
- `docs/production-runbook.md` – Manual run and alarm playbooks.
