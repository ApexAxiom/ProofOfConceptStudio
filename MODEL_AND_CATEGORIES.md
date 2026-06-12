# Model Configuration & Category Coverage

## OpenAI Model Configuration

All models are low-cost by default and can be overridden per service via environment variables.

### Current defaults:

1. **Brief Generation** (`apps/runner/src/llm/openai.ts`)
   - Default: `gpt-5-mini` (override with `BRIEF_WRITER_MODEL`)
   - Used for: Category-specific brief generation

2. **Chat** (`apps/web/src/lib/server/chat.ts` — live path on Amplify — and the mirrored `apps/api/src/routes/chat.ts`)
   - Default: `gpt-5-nano-2025-08-07` (override with `OPENAI_MODEL`)
   - Fallback models: `["gpt-4o-mini"]`
   - Reasoning effort: `low` by default (override with `OPENAI_REASONING_EFFORT`)
   - Used for: Interactive Q&A with briefs + OpenAI native web search
   - Max output tokens: 25,000 for reasoning models (configurable via `OPENAI_MAX_OUTPUT_TOKENS`)

### Chat model selection logic:
```typescript
const model = process.env.OPENAI_MODEL || "gpt-5-nano-2025-08-07";
```

Indicative pricing (per 1M tokens): gpt-5-nano $0.05 in / $0.40 out; gpt-5-mini $0.25 in / $2.00 out; gpt-4o-mini $0.15 in / $0.60 out. A typical chat turn (~15k context tokens in, ~700 out) costs well under a tenth of a cent on gpt-5-nano.

**Note**: The model can be changed via the `OPENAI_MODEL` environment variable. Any LLM provider/model can be used as long as it's compatible with the OpenAI API format or the code is adapted accordingly.

---

## Category Coverage

### Total Categories: **14 Category Agents + 1 Market Dashboard**

Each category agent generates briefs for **2 regions**:
- `us-mx-la-lng` (Americas - Houston)
- `au` (Australia - Perth)

### Expected Brief Count Per Run:
- **Category Briefs**: 14 categories × 2 regions = **28 briefs**
- **Market Dashboard**: 1 dashboard × 2 regions = **2 briefs**
- **Total**: **30 briefs per scheduled run**

### Category List:

1. **rigs-integrated-drilling** - Rigs & Integrated Drilling
2. **drilling-services** - Drilling Services
3. **wells-materials-octg** - Wells Materials & OCTG
4. **completions-intervention** - Completions & Intervention
5. **pa-decommissioning** - Plug & Abandonment / Decommissioning
6. **subsea-surf-offshore** - Subsea, SURF & Offshore
7. **projects-epc-epcm-construction** - Projects (EPC/EPCM & Construction)
8. **major-equipment-oem-ltsa** - Major Equipment OEM & LTSA
9. **ops-maintenance-services** - Operations & Maintenance Services
10. **mro-site-consumables** - MRO & Site Consumables
11. **logistics-marine-aviation** - Logistics, Marine & Aviation
12. **site-services-facilities** - Site Services & Facilities
13. **it-telecom-cyber** - IT, Telecom & Cyber
14. **professional-services-hr** - Professional Services & HR
15. **market-dashboard** - Market Dashboard (executive overview)

### Run Schedule:

- **All Categories & Regions**: Daily at 5:00 AM CST / 11:00 PM AWST (prev day)
  - Runs all 14 category agents + 1 market dashboard for both APAC (au) and International (us-mx-la-lng) regions
  - Total: 30 briefs per scheduled run (14 categories × 2 regions + 2 market dashboards)

---

## Verification

To verify all categories are getting briefs, check:

1. **DynamoDB**: Query for briefs by portfolio and region
2. **Run Logs**: Check `RUN#${runId}` entries in DynamoDB
3. **Recent Briefs**: Use the investigation script to check coverage

See `scripts/investigate-jan21.ts` for an example of how to query brief coverage.
