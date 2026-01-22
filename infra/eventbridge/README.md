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
# All categories and regions run
curl -X POST "https://your-runner.awsapprunner.com/cron" \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"regions":["au","us-mx-la-lng"],"scheduled":true}'

# Single region run (for testing)
curl -X POST "https://your-runner.awsapprunner.com/cron" \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"runWindow":"apac","regions":["au"],"scheduled":true}'
```

## Schedule Summary
- **All Categories & Regions**: Daily at 11:00 UTC (5:00 AM CST)
  - Runs all 14 category agents + 1 market dashboard for both APAC (au) and International (us-mx-la-lng) regions
  - Total: 30 briefs per scheduled run (14 categories × 2 regions + 2 market dashboards)
