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

### 3. Ensure secret contains CRON_SECRET
Your AWS Secrets Manager secret should include:
```json
{
  "CRON_SECRET": "your-cron-secret-value"
}
```

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
- **APAC**: 3 batches daily at 6:00/6:10/6:20 AM AWST
- **International**: 3 batches daily at 5:00/5:10/5:20 AM CST
- Each batch uses `batchIndex`/`batchCount` to deterministically select agents from the canonical catalog.
