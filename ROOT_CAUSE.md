# Chat Production Failure Root Cause

## What was broken
- `/api/chat` in the web app intermittently returned `503` or fallback answers in production. The UI showed “Briefs-only” even when secrets were configured.
- `/api/chat` in the web app could not reach the API service in App Runner unless `API_BASE_URL` was explicitly set.

## Why (root cause)
1. **Secrets timing bug in the API service**
   - `apps/api/src/routes/chat.ts` read `process.env.OPENAI_API_KEY` and created the OpenAI client at module load.
   - When `AWS_SECRET_NAME` is used, `initializeSecrets()` loads secrets **after** imports, leaving `openaiApiKey` as `undefined` for the lifetime of the module.
   - Result: `/chat/status` reported `enabled: false`, and `/chat` always returned fallback responses even though the secret existed.
2. **Missing API_BASE_URL in the web service**
   - `apps/web/src/app/api/chat/route.ts` falls back to `http://localhost:3001` when `API_BASE_URL` is missing.
   - In production App Runner, `localhost` is not the API service, so the proxy call fails and returns `503`.

## What changed
- **Lazy OpenAI client and env reads**: `apps/api/src/routes/chat.ts` now reads `OPENAI_API_KEY`, `OPENAI_MODEL`, and `OPENAI_MAX_OUTPUT_TOKENS` at request time and caches the client by key. This ensures secrets loaded at startup are honored.
- **Startup visibility**: `apps/api/src/server.ts` logs whether the OpenAI key is present, the selected model, and whether `RUNNER_BASE_URL` is configured (without logging secrets).
- **Web proxy resilience**: `apps/web/src/app/api/chat/route.ts` now uses request timeouts and returns `504` on timeout with friendly error text.

## How to verify
### API (direct)
```bash
curl -fsS "$API_BASE_URL/chat/status"
curl -fsS -X POST "$API_BASE_URL/chat" \
  -H "Content-Type: application/json" \
  -d '{"question":"What are the latest supplier risks?","region":"au","portfolio":"drilling"}'
```

### Web (proxy)
```bash
curl -fsS "$WEB_BASE_URL/api/chat" -H "Content-Type: application/json" \
  -d '{"question":"Summarize recent risks.","region":"au","portfolio":"drilling"}'
```

### UI
1. Open `/chat`.
2. Confirm status badge shows **AI online** when `OPENAI_API_KEY` is set on the API service.
3. Ask a question and verify a cited response is returned.
