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
- `ExpectedRunDue`
- `ExpectedRunCompleted`
- `ExpectedBriefPublished`

All metrics are emitted with `Region` dimension (`au` or `us-mx-la-lng`).

## CloudWatch Alarms
Deploy `infra/cloudformation/runner-alarms.yml` with an SNS topic for notifications.

Alarm set:
- Missed run alarm per region: `ExpectedRunCompleted < 1` over the daily scheduled-health period. Off-days emit healthy `1`; expected Tuesday/Thursday windows emit `0` when the run did not complete.
- Zero published briefs alarm per region: `ExpectedBriefPublished < 1` over the daily scheduled-health period. Off-days emit healthy `1`; expected Tuesday/Thursday windows emit `0` when no brief was published.
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
1. Inspect the latest `scheduled_run_health` log event for the failed region and brief day.
2. Verify EventBridge schedule invocation history for the failed region.
3. Verify runner `/cron` endpoint health and auth (`CRON_SECRET`).
4. If schedule failed, run one manual `/cron` invocation for the impacted region with `scheduled:false` and `force:true`.
5. Re-run `/scheduled-health` for the impacted region, then confirm `ExpectedRunCompleted` returns to `1`.

### Alarm: Zero Briefs By Region
1. Check whether runs completed but all ended as `no-updates` or `failed`.
2. Inspect ingestion metrics and feed failures since the last scheduled Tuesday/Thursday window.
3. Validate DynamoDB write path for publish failures.
4. Trigger one manual run after root cause is fixed, re-run `/scheduled-health`, and confirm `ExpectedBriefPublished` returns to `1`.

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
pnpm --filter runner run scheduled-health:smoke
pnpm --filter runner run feeds:audit
pnpm --filter runner run validate:smoke
pnpm --filter runner run validate:briefs
```

## Scheduled-Run Checklist
1. Confirm all runner alarms are `OK`.
2. After each Tuesday/Thursday window, confirm `ExpectedRunCompleted=1` and `ExpectedBriefPublished=1` for `au` and `us-mx-la-lng`.
3. Confirm ingestion failure rate is stable for both regions.
4. Review warning/error logs by `reasonCode` for new systemic issues.
