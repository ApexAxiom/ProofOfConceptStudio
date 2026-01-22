# Model Configuration & Category Coverage

## OpenAI Model Configuration

**Current Model: `gpt-4o`** (default across all services)

The model can be overridden via the `OPENAI_MODEL` environment variable, but currently defaults to **gpt-4o** in:

### Services Using gpt-4o:

1. **Brief Generation** (`apps/runner/src/llm/openai.ts`)
   - Default: `gpt-4o`
   - Used for: Category-specific brief generation
   - Temperature: 0.25 (for grounded outputs)
   - Max tokens: 3000

2. **Market Dashboard** (`apps/runner/src/llm/market-openai.ts`)
   - Default: `gpt-4o`
   - Used for: Executive market overview briefs
   - Temperature: 0.25
   - Max tokens: 3500

3. **Chat API** (`apps/api/src/routes/chat.ts`)
   - Default: `gpt-4o`
   - Fallback models: `["gpt-4o-mini"]`
   - Used for: Interactive Q&A with briefs
   - Max output tokens: 1000 (configurable via `OPENAI_MAX_OUTPUT_TOKENS`)

### Model Selection Logic:
```typescript
const model = process.env.OPENAI_MODEL || "gpt-4o";
```

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

- **All Categories & Regions**: Daily at 11:00 UTC (5:00 AM CST)
  - Runs all 14 category agents + 1 market dashboard for both APAC (au) and International (us-mx-la-lng) regions
  - Total: 30 briefs per scheduled run (14 categories × 2 regions + 2 market dashboards)

---

## Verification

To verify all categories are getting briefs, check:

1. **DynamoDB**: Query for briefs by portfolio and region
2. **Run Logs**: Check `RUN#${runId}` entries in DynamoDB
3. **Recent Briefs**: Use the investigation script to check coverage

See `scripts/investigate-jan21.ts` for an example of how to query brief coverage.
