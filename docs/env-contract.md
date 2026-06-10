# Environment Variable Contract

**Do not rename environment variable keys.**

## Web (`apps/web`)
- `API_BASE_URL`
- `CHAT_MAX_CONTEXT_CHARS`
- `CHAT_PROOF_CONTEXT_TIMEOUT_MS`
- `CHAT_PROOF_CONTEXT_TTL_MS`
- `CHAT_WEB_SEARCH_MODE`
- `EXECUTIVE_DASHBOARD_CACHE_SECONDS`
- `PORT`
- `WEB_SEARCH_ENABLED`

## API (`apps/api`)
- `ADMIN_TOKEN`
- `AWS_REGION`
- `CHAT_FALLBACK_CONTEXT`
- `CHAT_MAX_CLAIMS`
- `CHAT_MAX_CONTEXT_CHARS`
- `CHAT_PROOF_CONTEXT_TIMEOUT_MS`
- `CHAT_PROOF_CONTEXT_TTL_MS`
- `CHAT_RATE_LIMIT_BURST`
- `CHAT_RATE_LIMIT_DISABLED`
- `CHAT_RATE_LIMIT_RPM`
- `CHAT_STATUS_CACHE_MS`
- `CHAT_STATUS_VERIFY`
- `CHAT_WEB_SEARCH_MODE`
- `CORS_ORIGINS`
- `DDB_ENDPOINT`
- `DDB_TABLE_NAME`
- `DEBUG_CHAT_LOGGING`
- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`
- `OPENAI_MAX_OUTPUT_TOKENS`
- `OPENAI_MODEL`
- `PORT`
- `RUNNER_BASE_URL`
- `WEB_SEARCH_ENABLED`

## Runner (`apps/runner`)
- `AWS_REGION`
- `BING_IMAGE_ENDPOINT`
- `BING_IMAGE_KEY`
- `CRON_SECRET`
- `DDB_ENDPOINT`
- `DDB_TABLE_NAME`
- `EVIDENCE_AUTO_MATCH_THRESHOLD`
- `EVIDENCE_SIMILARITY_THRESHOLD`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `PORT`
- `VALIDATE_BRIEFS_LIMIT`

## Shared (`packages/shared`)
- `ADMIN_TOKEN`
- `AWS_REGION`
- `AWS_SECRET_NAME`
- `CRON_SECRET`
- `SECRETS_CACHE_TTL_MS`

## Digest (runner, optional)
| Var | Required | Notes |
| --- | --- | --- |
| `DIGEST_ENABLED` | no (default `false`) | Master switch for the daily email digest. |
| `DIGEST_FROM_ADDRESS` | when enabled | SES-verified sender address. |
| `DIGEST_RECIPIENTS` | when enabled | Comma-separated recipient list. |
| `DIGEST_SES_REGION` | no | Defaults to `AWS_REGION` / `us-east-1`. |
| `DIGEST_SITE_BASE_URL` | no | Link base for brief URLs; defaults to `SITE_URL`. |

## Market data history (runner, optional)
| Var | Required | Notes |
| --- | --- | --- |
| `MARKET_HISTORY_ENABLED` | no (default `false`) | Master switch for fetching and storing official-source daily market history (EIA, FRED, Baker Hughes rig count, ACCC LNG netback) and for enriching brief market tiles with week-over-week trend. No-op when false. |
| `EIA_API_KEY` | no | Free key from https://www.eia.gov/opendata/. Without it the EIA series (WTI/Brent/Henry Hub spot) are skipped. |
| `FRED_API_KEY` | no | Free key from https://fred.stlouisfed.org/docs/api/api_key.html. Without it the FRED series (diesel retail, steel PPI) are skipped. |
| `ACCC_NETBACK_CSV_URL` | no | Direct URL to the current ACCC LNG netback price series CSV download (the ACCC moves the file between publications). Without it the netback series is skipped. |

Baker Hughes rig count is keyless (parsed from the public rig count overview page). Adapters never publish fabricated values: any fetch/parse failure simply yields no data for that series.

## Site access gate (web, optional)
| Var | Required | Notes |
| --- | --- | --- |
| `SITE_ACCESS_GATE` | no (default `false`) | When `true` and chat admin credentials are set, the whole site requires sign-in (`/login`); `/api/healthz`, robots, and sitemap stay public. |
