# Diagnosis: Missing Briefs Investigation

## Summary

Several categories haven't updated for a few days, and IT category has never had a brief. This document outlines the investigation findings and recommendations.

## Potential Root Causes

### 1. **Scheduler Not Running**
- **Issue**: The scheduler may not be executing properly
- **Evidence**: If no run logs exist for recent days, the scheduler isn't triggering
- **Check**: Run `scripts/diagnose-missing-briefs.ts` to see run activity
- **Fix**: Verify EventBridge Scheduler is enabled and configured correctly

### 2. **Ingestion Failures (No Articles Found)**
- **Issue**: Feeds may not be returning articles, or all articles are filtered out
- **Code Location**: `apps/runner/src/run.ts:141-146`
- **What happens**: If `articles.length === 0`, the run fails with error "No articles found after ingestion"
- **Common causes**:
  - RSS feed URLs are broken or returning empty feeds
  - Network connectivity issues
  - All articles filtered as duplicates (used in recent runs)
  - Domain filtering blocking all articles

### 3. **Validation Failures**
- **Issue**: Briefs are generated but fail validation, resulting in "draft" status
- **Code Location**: `apps/runner/src/run.ts:271-285`
- **What happens**: Briefs with validation issues are saved as "draft" with `status: "draft"` and `qualityReport: { issues, decision: "block" }`
- **Common validation failures**:
  - Selected articles missing URLs
  - URLs in markdown not in allowed list
  - Insufficient evidence
  - Numeric claims not supported

### 4. **IT Category Specific Issues**
The IT category (`it-telecom-cyber`) is properly configured in `apps/runner/src/agents/agents.yaml` with feeds for both regions. If it's never generated a brief, likely causes:

1. **Feed Issues**: IT feeds may be failing to return articles
   - Check if RSS feeds are accessible: `https://www.darkreading.com/rss.xml`, `https://www.bleepingcomputer.com/feed/`, etc.
   - Some feeds may require authentication or have rate limiting

2. **Article Filtering**: All articles may be filtered out
   - Check if articles are being marked as duplicates
   - Verify domain filtering isn't blocking all sources

3. **No Runs**: The category may never have been executed
   - Check run logs for `it-telecom-cyber` entries

## Diagnostic Steps

### Step 1: Check Category Coverage
```bash
pnpm exec tsx scripts/check-category-coverage.ts
```

This will show which categories have missing briefs in the last 3 days.

### Step 2: Run Comprehensive Diagnostics
```bash
pnpm exec tsx scripts/diagnose-missing-briefs.ts
```

This will show:
- Published briefs by category
- Failed run logs
- Draft/failed briefs with validation issues
- Recent run activity

### Step 3: Check Scheduler Status
```bash
# Check if scheduler is configured
aws scheduler list-schedules --region us-east-1

# Check execution history
aws scheduler list-schedule-executions --name briefs-daily-all-categories --region us-east-1
```

### Step 4: Manually Test a Run
```bash
# Test IT category specifically
curl -X POST "https://<runner-url>/cron" \
  -H "Authorization: Bearer <CRON_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"regions":["au","us-mx-la-lng"],"scheduled":false}'
```

Or test just IT category:
```bash
curl -X POST "https://<runner-url>/run/it-telecom-cyber" \
  -H "Authorization: Bearer <CRON_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"region":"au","runWindow":"apac"}'
```

## Code Locations to Review

1. **Agent Configuration**: `apps/runner/src/agents/agents.yaml` (line 282-308 for IT)
2. **Run Logic**: `apps/runner/src/run.ts` (lines 99-347)
3. **Ingestion**: `apps/runner/src/ingest/fetch.ts` (lines 140-317)
4. **Validation**: `apps/runner/src/publish/validate.ts`
5. **Scheduler Config**: `infra/eventbridge/scheduler.yml`

## Recommendations

### Immediate Actions

1. **Run Diagnostics**: Execute `scripts/diagnose-missing-briefs.ts` to identify specific failures
2. **Check Scheduler**: Verify the EventBridge Scheduler is enabled and has executed recently
3. **Review Run Logs**: Check DynamoDB for `RUN#` entries to see which categories are failing and why
4. **Check Draft Briefs**: Look for briefs with `status: "draft"` to identify validation issues

### For IT Category Specifically

1. **Test Feeds Manually**: Verify IT category RSS feeds are accessible
2. **Check Ingestion Logs**: Look for errors when fetching from IT feeds
3. **Test Manual Run**: Manually trigger IT category to see real-time errors
4. **Review Feed URLs**: Some IT security feeds may have changed URLs or require authentication

### Long-term Fixes

1. **Add Monitoring**: Set up CloudWatch alarms for failed runs
2. **Improve Error Reporting**: Add more detailed error messages for ingestion failures
3. **Feed Health Checks**: Periodically verify feed URLs are accessible
4. **Retry Logic**: Add retry logic for transient feed failures

## Next Steps

1. Run the diagnostic script to get specific failure reasons
2. Check the scheduler execution history
3. Review CloudWatch logs for the runner service
4. Manually test the IT category to see real-time errors
5. Fix identified issues (feed URLs, validation rules, etc.)
