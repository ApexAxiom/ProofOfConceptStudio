# AGENTS.md — POCStudio (Codex/Agents)

## Purpose
This repo powers the Intelligence Hub (web), API, and runner that generate category briefs and enable category-specific chat.
Agents must respect region + portfolio selections and use the correct category preprompt.

## Repo map (quick)
- `apps/web` – Next.js UI (chat page, context selectors)
- `apps/api` – Fastify API (chat endpoint, agents proxy, DynamoDB briefs)
- `apps/runner` – Brief generation + agent registry (agents.yaml)
- `packages/shared` – shared types, portfolio config, agent prompts

## Core chat flow (must preserve)
1. Web: `/chat` sends `{ region, portfolio, agentId, briefId? }` to `/api/chat`
2. Web API proxy: `/api/chat` → API `/chat`
3. API `/chat`:
   - resolves agent from runner `/agents`
   - loads latest brief for region+portfolio
   - builds system prompt from `buildAgentSystemPrompt`
   - sends to OpenAI
4. Runner `/agents` is the source of truth for agent list.

## Agent config and prompts
- Agent definitions: `apps/runner/src/agents/agents.yaml`
- Category prompt: `packages/shared/src/agent-registry.ts`
- Ensure the agent selected in UI matches `region + portfolio` in API.

## Region + portfolio slugs
- Regions: `au`, `us-mx-la-lng`
- Portfolios: see `packages/shared/src/portfolios.ts`

## Key environment variables
- `OPENAI_API_KEY` (required for AI answers)
- `OPENAI_MODEL` (optional, default gpt-4o)
- `OPENAI_MAX_OUTPUT_TOKENS` (optional)
- `RUNNER_BASE_URL` (API → runner `/agents`)
- `WEB_SEARCH_ENABLED` (true/false)
- `DDB_TABLE_NAME` (briefs)

## Local dev
- `pnpm dev` (runs web + api + runner)
- `pnpm run:apac` / `pnpm run:international` (manual brief run)

## Data notes
- DynamoDB is authoritative for published briefs.
- If briefs lack evidence, chat should still answer using brief summaries and web context.

## Guardrails
- Do not change agent category mapping unless requested.
- Do not modify DynamoDB data directly without explicit approval.
- Keep prompts category-specific (no cross-category bleed).

## Troubleshooting
- Missing agents: check `RUNNER_BASE_URL` and runner `/agents`
- Chat says "Briefs-only": `OPENAI_API_KEY` missing or invalid
- Wrong agent used: check `region + portfolio` match in API `/chat` and `agents.yaml`
