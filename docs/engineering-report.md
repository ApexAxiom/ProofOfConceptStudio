# Engineering Report: Evidence-First Briefs + Category Agents

Date: January 21, 2026

## Executive Summary
- Root cause of mismatched citations: briefs had a flat `sources[]` list that was not tied to individual claims, and prompts did not require evidence tags. The UI always rendered those sources, even when summary/highlights were derived from unrelated content.
- Fix: evidence-first schema (`claims[]` with per-claim evidence, `sources[]` derived only from supported evidence) plus similarity checks and validation gates. Unsupported claims degrade to "analysis"/"needs verification" and are blocked from publishing when critical sections lack evidence.
- Chat fix: chat now scopes to a specific brief, pulls evidence-backed claims, and returns grounded answers with citations; if the OpenAI key is missing or model unavailable, it returns a safe evidence-only response.
- Category agents: centralized registry for prompts and interpretation frameworks in `packages/shared/src/agent-registry.ts`; runner and API consume it to keep category-specific behavior consistent and extensible.

## Data Lifecycle (Explicit Pipeline)

```text
Feeds/RSS/Web
  -> ingest (apps/runner/src/ingest/fetch.ts)
     - rss fetch (apps/runner/src/ingest/rss.ts)
     - content extraction (apps/runner/src/ingest/extract.ts)
     - dedupe + history filter (apps/runner/src/ingest/dedupe.ts, apps/runner/src/db/used-urls.ts)
  -> analysis prompt build (apps/runner/src/llm/prompts.ts, apps/runner/src/llm/market-prompts.ts)
     - evidence excerpts embedded per article
  -> LLM generation (apps/runner/src/llm/openai.ts, apps/runner/src/llm/market-openai.ts)
  -> evidence + citations (apps/runner/src/publish/evidence.ts)
     - claims, evidence excerpts, similarity scoring
  -> validation gates (apps/runner/src/publish/validate.ts, apps/runner/src/publish/factuality.ts)
  -> publish to DynamoDB (apps/runner/src/publish/dynamo.ts)
  -> API retrieval (apps/api/src/db/posts.ts, apps/api/src/routes/posts.ts)
  -> UI rendering (apps/web/src/app/brief/BriefDetailContent.tsx, apps/web/src/components/BriefClaims.tsx, apps/web/src/components/FooterSources.tsx)
  -> Chat grounded to brief claims (apps/api/src/routes/chat.ts, apps/web/src/app/chat/page.tsx)
```

## Root Cause(s) of Incorrect Source Links
1. **No claim-to-source mapping**: the system stored a flat `sources[]` list derived from selected articles and indices, not from the actual claims shown in the brief.
2. **Prompting allowed untagged claims**: summary/highlights/actions were not forced to include evidence tags, so claims could drift away from the selected sources.
3. **No validation gate**: nothing blocked publishing a brief whose claims did not align with the provided sources.
4. **UI always displayed sources**: the interface rendered source links even when the narrative content was unsupported by them.

Reproduction example (local):
- Brief ID `fb1abec5-3964-4196-b54a-0e1c9e4c04e6` (AU) had a wage-growth summary, but sources were mining articles. This confirmed the pipeline had no claim-level source constraints.

## How the Fix Prevents Recurrence
- **Evidence-first schema**: `BriefPost` now stores `claims[]` with per-claim evidence and `sources[]` derived only from supported evidence. See `packages/shared/src/types.ts`.
- **Evidence attachment & similarity checks**: `apps/runner/src/publish/evidence.ts` parses evidence tags, finds excerpts, computes similarity, and labels claims as `supported`, `analysis`, or `needs_verification`.
- **Validation gate**: `apps/runner/src/publish/validate.ts` enforces that sources are only those referenced by supported claims and that evidence sources must exist in `sources[]`.
- **UI evidence rendering**: `apps/web/src/components/BriefClaims.tsx` shows claim status, evidence excerpts, and verified citations only; `FooterSources` now renders normalized sources.
- **Legacy safeguards**: briefs without evidence claims hide primary-source links and show a warning in the detail view to avoid displaying unverified citations.

## Agent Failure Root Cause & Fix
- **Root cause**: `/chat` hard-failed when `OPENAI_API_KEY` was missing or the model was unavailable; the UI expected a response and had no fallback.
- **Fixes**:
  - `apps/api/src/routes/chat.ts` now scopes to a specific brief, extracts evidence-backed claims, and generates grounded answers with citations.
  - If OpenAI is unavailable, it returns an evidence-only response instead of a 503.
  - The UI now shows AI status and supports brief-scoped chat with citations (`apps/web/src/app/chat/page.tsx`).

## Category Agents (Registry + Extension)
- **Registry**: `packages/shared/src/agent-registry.ts` contains category frameworks, focus areas, key suppliers, and system prompts.
- **Usage**:
  - Runner prompts pull from the registry via `buildAgentSystemPrompt` and `getAgentFramework`.
  - API chat uses the same framework to keep advice consistent.
- **Adding a new agent**:
  1. Add a new framework entry in `packages/shared/src/agent-registry.ts`.
  2. Add a new agent config + feeds in `apps/runner/src/agents/agents.yaml`.
  3. No core logic changes required.

## How to Run Locally
1. Install dependencies: `pnpm install`
2. Build shared package: `pnpm --filter @proof/shared build`
3. Copy `.env.example` to `.env` and set required values.
4. Start services: `pnpm dev`
5. Trigger a run:
   - APAC: `pnpm run:apac`
   - International: `pnpm run:international`

## How to Validate
- Evidence smoke test: `pnpm --filter runner run evidence:smoke`
- Brief validation (claims + sources): `pnpm --filter runner run validate:briefs`
- Chat smoke test: `pnpm exec tsx scripts/smokeChat.ts`

## Observability
- Runner logs now include structured events (`ingest_complete`, `brief_validation_failed`, `brief_published`) with `runId`, `agentId`, and `region`.
- Chat logs include briefId, agentId, citations count, and timing; use `DEBUG_CHAT_LOGGING=true` to log truncated questions.

## Files of Interest
- Evidence schema + sources: `packages/shared/src/types.ts`, `packages/shared/src/source-utils.ts`
- Evidence attachment: `apps/runner/src/publish/evidence.ts`
- Validation: `apps/runner/src/publish/validate.ts`, `apps/runner/src/publish/factuality.ts`
- Chat grounding: `apps/api/src/routes/chat.ts`, `apps/web/src/app/chat/page.tsx`
- UI evidence display: `apps/web/src/components/BriefClaims.tsx`

---

If you want additional CI checks (e.g., automated `validate:briefs` on new publishes), this can be added to the runner pipeline or a nightly job.
