# Deployment Configuration

This file contains the deployed service URLs and credentials for POCStudio services.

## Service URLs

**NOTE**: Verify these URLs in AWS App Runner console. The API URL may be different from the web URL.

- **API Service (pocstudio-api)**: `https://99m2qtvgzb.us-east-1.awsapprunner.com` ✅ Verified
- **Runner Service (pocstudio-runner)**: `https://pe8rz3uzip.us-east-1.awsapprunner.com` ✅ Verified
- **Web Service (pocstudio-web)**: `https://dqjea3w6uv.us-east-1.awsapprunner.com` ✅ Verified

**To find API URL**: Check AWS App Runner console for `pocstudio-api` service URL, or check the API service's environment variables.

## Environment Variables (from pocstudio-api)

### Authentication
- **ADMIN_TOKEN**: `zzAFPKfQsJUBtGgKGYHVXrpjhOfjjpSL`
- **CRON_SECRET**: `P_1ASC1Ann0ZG2KANXORRD32-OgCWUqMl21Zm3ncvYM`

### AWS Configuration
- **AWS_REGION**: `us-east-1`
- **DDB_TABLE_NAME**: `CMHub`

### OpenAI Configuration
- **OPENAI_API_KEY**: `sk-proj-610UaVbrNiFlxq-KdcCOdjHbuQQ0xmdlWi-MUq5qg77dBfKQdrxBVDOzBYyZedV4LSIZb-x_T-T3BlbkFJK5BZ89hoPxw8MWEF02YyuB4Dp6wzub9fR2HF66YcKxO8lVqXIgw1Aomahpa4Mal`
- **OPENAI_MODEL**: `gpt-4o-mini`

### Service URLs
- **RUNNER_BASE_URL**: `https://pe8rz3uzip.us-east-1.awsapprunner.com`

### Other Settings
- **CORS_ORIGINS**: `https://dqjea3w6uv.us-east-1.awsapprunner.com, https://proofofconceptstudio.com, https://www.proofofconceptstudio.com`
- **CHAT_STATUS_CACHE_MS**: `60000`
- **CHAT_STATUS_VERIFY**: `true`

## Usage

### Trigger Brief Run via API
```bash
API_BASE_URL=https://99m2qtvgzb.us-east-1.awsapprunner.com ADMIN_TOKEN=zzAFPKfQsJUBtGgKGYHVXrpjhOfjjpSL pnpm run run-briefs all
```

### Trigger Brief Run via Runner (Direct)
```bash
curl -X POST "https://pe8rz3uzip.us-east-1.awsapprunner.com/cron" \
  -H "Authorization: Bearer P_1ASC1Ann0ZG2KANXORRD32-OgCWUqMl21Zm3ncvYM" \
  -H "Content-Type: application/json" \
  -d '{"regions":["au","us-mx-la-lng"],"scheduled":false,"force":true}'
```

## Notes

- These credentials are for the deployed production/staging environment
- Do not commit actual secrets to git - this file should be in .gitignore or use environment-specific values
- API_BASE_URL is inferred from CORS_ORIGINS - verify if different
