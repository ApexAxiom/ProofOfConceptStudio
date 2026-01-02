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

## GitHub Actions (Fallback)

### 1. Configure repository secrets
- `RUNNER_BASE_URL`: https://your-runner.awsapprunner.com
- `CRON_SECRET`: your-cron-secret-value

### 2. Enable workflow
The workflow in `.github/workflows/daily-briefs.yml` will run automatically.

## Manual Testing

Test the endpoints manually:

```bash
# APAC run
curl -X POST "https://your-runner.awsapprunner.com/cron" \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"runWindow":"apac","regions":["au"],"scheduled":true}'

# International run
curl -X POST "https://your-runner.awsapprunner.com/cron" \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"runWindow":"international","regions":["us-mx-la-lng"],"scheduled":true}'
```

## Schedule Summary
- **APAC**: Daily at 22:00 UTC (6:00 AM AEST)
- **International**: Daily at 11:00 UTC and 12:00 UTC (6:00 AM and 7:00 AM CDT)