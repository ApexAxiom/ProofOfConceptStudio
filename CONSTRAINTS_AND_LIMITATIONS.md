# Constraints and Limitations

This document lists technical constraints, limitations, and best practices that may affect development work.

## Technical Constraints

### 1. LLM Output Formatting Rules
**Location**: `apps/runner/src/llm/prompts.ts`, `apps/runner/src/llm/writing-guide.ts`

These are **prompt engineering constraints** for LLM output quality, not development limitations:
- "Do NOT output URLs in JSON" - URLs are referenced by articleIndex only
- "Do NOT use numbers from articles marked CONTENT_MISSING"
- "Never invent, modify, or guess URLs"
- Various forbidden phrases for writing quality

**Impact**: These affect LLM prompt design, not general development work.

### 2. Security Constraints
**Location**: `README.md`

- **No secrets committed**: Use env vars or AWS Secrets Manager
- **Admin token**: Entered at runtime in UI, not exposed via `NEXT_PUBLIC` envs

**Impact**: Standard security best practices - should be followed.

### 3. App Runner Deployment Constraints
**Location**: `README.md`, `apprunner.yaml` files

- Source directory must match app folder (e.g., `apps/web`, not repo root)
- Must use configuration files (`apprunner.yaml`)
- Ports must bind to `0.0.0.0`
- Health check paths are fixed per service

**Impact**: Deployment structure requirements - necessary for AWS App Runner.

### 4. DynamoDB Schema Constraints
**Location**: `apps/runner/src/publish/dynamo.ts`, `infra/cloudformation/main.yml`

- Fixed primary key structure: `PK: POST#${postId}`, `SK: DATE#${publishedAt}`
- GSI keys for querying: portfolio-date, region-date, status-date
- TTL: 6 months retention

**Impact**: Data model structure - changes would require migration.

### 5. Agent Configuration Schema
**Location**: `packages/shared/src/agent-schema.ts`, `apps/runner/src/agents/agents.yaml`

- Agents must have specific structure (id, portfolio, label, feedsByRegion, etc.)
- Validation enforces required fields
- Mode must be "brief" or "market-dashboard"

**Impact**: Agent configuration format - changes would require updates to validation.

## Development Best Practices (Not Constraints)

### Writing Guide
**Location**: `apps/runner/src/llm/writing-guide.ts`

- Centralized writing rules for LLM brief generation
- Can be modified to adjust tone, structure, word limits
- **Not a constraint** - this is a configuration file that can be updated

### Code Style
- TypeScript throughout
- pnpm workspaces
- Modular structure (apps/, packages/)

## No Blocking Constraints Found

After review, there are **no user-defined rules or constraints that would limit general development work**. The constraints found are:

1. ✅ **Technical requirements** (App Runner, DynamoDB schema) - necessary for deployment
2. ✅ **Security best practices** (no secrets in code) - standard practice
3. ✅ **LLM prompt rules** - affect AI output quality, not development freedom
4. ✅ **Configuration schemas** - can be extended/modified as needed

## Recommendations

- All constraints are reasonable and necessary for the system to function
- No artificial limitations on development work
- Writing guide and prompt constraints can be modified as needed
- Agent configuration can be extended with new fields

---

**Last Updated**: 2025-01-21
