# Tuesday/Thursday Brief Scheduler Setup

## AWS EventBridge (Recommended)

### 1. Deploy the scheduler
```bash
cd infra/eventbridge
chmod +x deploy.sh
./deploy.sh
```

### 2. Update parameters in deploy.sh
- Set `RUNNER_BASE_URL` to your App Runner service URL
- Set `SECRET_ARN` to your AWS Secrets Manager secret ARN

### 3. Ensure secret stores the cron secret
The Lambda proxy supports either format:

```json
{
  "CRON_SECRET": "your-cron-secret-value"
}
```

or a plain string value containing only the cron secret.

## Manual Testing

Test the endpoints manually:

```bash
# APAC batch run (batch 0)
curl -X POST "https://your-runner.awsapprunner.com/cron" \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"runWindow":"apac","regions":["au"],"scheduled":true,"batchIndex":0,"batchCount":3}'

# International batch run (batch 0)
curl -X POST "https://your-runner.awsapprunner.com/cron" \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"runWindow":"international","regions":["us-mx-la-lng"],"scheduled":true,"batchIndex":0,"batchCount":3}'
```

## Schedule Summary
- **APAC**: Tuesday/Thursday at 6:00 AM Australia/Perth, batched at 0/10/20 minutes
- **International**: Tuesday/Thursday at 5:00 AM America/Chicago, batched at 0/10/20 minutes
- **APAC health check**: daily at 9:00 AM Australia/Perth
- **International health check**: daily at 8:00 AM America/Chicago
- Schedules invoke the Lambda proxy, which reads `CRON_SECRET` from Secrets Manager and forwards to runner `/cron`.
- Runner skips scheduled, non-force, non-dry-run requests outside Tuesday/Thursday local time with `reason: "scheduled_runs_only_tuesday_thursday"`.
- The daily health checks forward to runner `/scheduled-health` and emit `ExpectedRunCompleted` / `ExpectedBriefPublished` metrics that are healthy on off-days and fail only for missed expected windows.
