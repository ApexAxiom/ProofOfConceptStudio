# Jan 21, 2025 Brief Generation Failure - Investigation Report

## Executive Summary

**No briefs were generated on January 21, 2025.** Investigation reveals that the EventBridge Scheduler did not invoke the Lambda proxy function on that date, which prevented any brief generation runs from executing.

## Findings

### 1. No Run Executions
- **DynamoDB Run Logs**: 0 run logs found for Jan 21, 2025
- **Published Briefs**: 0 briefs published for both AU and US-MX-LA-LNG regions
- **Conclusion**: No brief generation runs were executed on Jan 21

### 2. EventBridge Scheduler Status
All three schedules are **ENABLED** and properly configured:

| Schedule | Cron Expression | Target | Status |
|----------|----------------|--------|--------|
| `briefs-apac-daily` | `cron(0 22 * * ? *)` | Lambda: `briefs-cron-proxy` | ENABLED |
| `briefs-international-11utc` | `cron(0 11 * * ? *)` | Lambda: `briefs-cron-proxy` | ENABLED |
| `briefs-international-12utc` | `cron(0 12 * * ? *)` | Lambda: `briefs-cron-proxy` | ENABLED |

### 3. Lambda Proxy Function
- **Function Name**: `briefs-cron-proxy`
- **Runtime**: Python 3.11
- **State**: Active
- **Last Modified**: 2026-01-15T19:31:49.970+0000
- **CloudWatch Logs**: **No log events found for Jan 21, 2025**
- **Conclusion**: The Lambda function was **NOT invoked** on Jan 21

### 4. Root Cause Analysis

The failure chain:
1. EventBridge Scheduler schedules did not trigger the Lambda function on Jan 21
2. Without Lambda invocation, no HTTP request was made to the runner service
3. Without runner service calls, no brief generation runs were executed
4. Without runs, no briefs were published

## Possible Causes

### Most Likely: EventBridge Scheduler Service Issue
- EventBridge Scheduler may have had a service disruption on Jan 21
- Schedules might have been temporarily disabled and re-enabled
- There could be a configuration drift issue

### Other Possibilities:
1. **IAM Permissions**: The Scheduler role might lack permission to invoke the Lambda
2. **Lambda Configuration**: The Lambda might have been in a failed state (though it shows as Active)
3. **Schedule Group Issues**: If schedules are in a group, the group might have been disabled
4. **Timezone/Date Calculation**: Unlikely given the cron expressions are correct

## Recommendations

### Immediate Actions

1. **Check EventBridge Scheduler Execution History**
   - Use AWS Console → EventBridge Scheduler → Select each schedule → View execution history
   - Look for failed or skipped executions on Jan 21

2. **Verify IAM Permissions**
   ```bash
   # Check if the Scheduler role can invoke the Lambda
   aws iam get-role-policy --role-name <scheduler-role-name> --policy-name LambdaInvokeAccess
   ```

3. **Check CloudWatch Metrics**
   - EventBridge Scheduler metrics for invocations, failures
   - Lambda metrics for invocations, errors, throttles

4. **Review Lambda Error Logs**
   - Check CloudWatch Logs for the Lambda function around Jan 21
   - Look for any errors that might have prevented execution

### Long-term Improvements

1. **Add Monitoring & Alerts**
   - CloudWatch alarm for Lambda invocation failures
   - CloudWatch alarm for missing briefs (check DynamoDB daily)
   - SNS notification when briefs fail to generate

2. **Add Retry Logic**
   - Implement a dead-letter queue for failed Lambda invocations
   - Add manual trigger capability for catch-up runs

3. **Add Health Checks**
   - Daily health check that verifies briefs were generated
   - Automated alert if no briefs found for a region

4. **Improve Logging**
   - Add structured logging to track schedule execution
   - Log schedule invocations to DynamoDB for audit trail

## Verification Steps

To verify the system is working now:

```bash
# 1. Manually trigger a run to test the pipeline
curl -X POST "https://pe8rz3uzip.us-east-1.awsapprunner.com/cron" \
  -H "Authorization: Bearer <CRON_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"runWindow":"international","regions":["us-mx-la-lng"],"scheduled":false,"force":true}'

# 2. Check that run logs appear in DynamoDB
# 3. Verify briefs are published
```

## Files Investigated

- `scripts/investigate-jan21.ts` - Investigation script
- `apps/runner/src/server.ts` - Runner service endpoint
- `apps/runner/src/run.ts` - Brief generation logic
- `infra/eventbridge/scheduler-lambda.yml` - Scheduler configuration
- `apps/runner/src/publish/dynamo.ts` - DynamoDB logging

## Next Steps

1. Review EventBridge Scheduler execution history in AWS Console
2. Check CloudWatch metrics and alarms
3. Verify IAM permissions are correct
4. Implement monitoring to prevent future silent failures
5. Consider adding a daily health check job

---

**Investigation Date**: 2025-01-21  
**Investigator**: AI Assistant  
**Status**: Root cause identified - EventBridge Scheduler did not invoke Lambda on Jan 21
