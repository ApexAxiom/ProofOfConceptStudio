# Production Runbook

## Scope
This runbook covers day-to-day operations for the Intelligence Hub pipeline:
- EventBridge schedule triggers runner `/cron`
- Runner ingests sources, generates briefs, validates, and writes to DynamoDB
- API and web read published briefs from DynamoDB

## Reliability Signals
Runner emits CloudWatch Embedded Metrics to namespace `POCStudio/Runner` (or `RUNNER_METRIC_NAMESPACE` if set):
- `RunCompleted`
- `PublishedBriefs`
- `FailedBriefs`
- `NoUpdateBriefs`
- `CoverageMissingCount`
- `IngestionFeedAttempts`
- `IngestionFeedErrors`
- `IngestionFeedEmpty`
- `IngestionFeedSuccess`
- `IngestionFailureRatePct`

All metrics are emitted with `Region` dimension (`au` or `us-mx-la-lng`).

## CloudWatch Alarms
Deploy `infra/cloudformation/runner-alarms.yml` with an SNS topic for notifications.

Alarm set:
- Missed run alarm per region: `RunCompleted < 1` over 24h, missing data is breaching
- Zero published briefs alarm per region: `PublishedBriefs < 1` over 24h, missing data is breaching
- Ingestion failure rate alarm per region: `(IngestionFeedErrors / IngestionFeedAttempts) * 100` exceeds threshold (default 25%)

## Deploy Alarms
Create or reuse an SNS topic:

```bash
aws sns create-topic --name pocstudio-ops-alerts
```

Deploy/update alarm stack:

```bash
aws cloudformation deploy \
  --stack-name pocstudio-runner-alarms \
  --template-file infra/cloudformation/runner-alarms.yml \
  --parameter-overrides \
    AlarmTopicArn=arn:aws:sns:us-east-1:ACCOUNT_ID:pocstudio-ops-alerts \
    MetricNamespace=POCStudio/Runner \
    ApacRegionDimension=au \
    InternationalRegionDimension=us-mx-la-lng
```

Validate alarm state:

```bash
aws cloudwatch describe-alarms --alarm-name-prefix pocstudio-runner-
```

## On-call Triage
For all incidents, capture:
- region
- runWindow
- runDate
- reasonCode
- affected agentId or portfolio

Use runner logs and filter by structured events:
- `feed_fetch_failed`
- `feed_fetch_empty`
- `run_ingest_failed`
- `run_generation_failed`
- `run_validation_failed`
- `run_publish_failed`
- `coverage_missing`
- `run_unhandled_error`

## Response Playbooks
### Alarm: Missed Run
1. Verify EventBridge schedule invocation history for the failed region.
2. Verify runner `/cron` endpoint health and auth (`CRON_SECRET`).
3. If schedule failed, run one manual `/cron` invocation for the impacted region.
4. Confirm `RunCompleted` metric resumes and alarm returns to OK.

### Alarm: Zero Briefs By Region
1. Check whether runs completed but all ended as `no-updates` or `failed`.
2. Inspect ingestion metrics and feed failures in the same 24h window.
3. Validate DynamoDB write path for publish failures.
4. Trigger one manual run after root cause is fixed and confirm `PublishedBriefs > 0`.

### Alarm: High Ingestion Failure Rate
1. Check top failing feeds from runner logs (`feed_fetch_failed`).
2. Remove/replace dead feeds in source catalog when a feed is consistently failing.
3. Confirm retries succeed and failure rate returns below threshold.
4. Re-run feed health checks: `pnpm --filter runner run feeds:audit`.

## Manual Operational Commands
Run local validation before production changes:

```bash
pnpm exec tsx scripts/smoke.ts
pnpm smoke:core
pnpm --filter runner run feeds:audit
pnpm --filter runner run validate:smoke
pnpm --filter runner run validate:briefs
```

## Daily Checklist
1. Confirm all runner alarms are `OK`.
2. Confirm at least one published brief exists for `au` and `us-mx-la-lng` in last 24h.
3. Confirm ingestion failure rate is stable for both regions.
4. Review warning/error logs by `reasonCode` for new systemic issues.
