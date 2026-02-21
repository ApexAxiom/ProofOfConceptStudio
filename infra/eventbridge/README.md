# Daily Brief Scheduler Setup

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
- **APAC**: daily at 6:00 AM AWST
- **International**: daily at 5:00 AM CST and 6:00 AM CST
- Schedules invoke the Lambda proxy, which reads `CRON_SECRET` from Secrets Manager and forwards to runner `/cron`.
