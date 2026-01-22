# Brief Generation Improvement Task

## Context
The POCStudio system generates daily intelligence briefs for 15 procurement categories across 2 regions (APAC/AU and International/US-MX-LatAm-LNG). Currently, many briefs are failing validation due to strict FACTCHECK requirements, and we need to expand news sources using Google News RSS feeds.

## Current State

### Architecture
- **Runner service** (`apps/runner`): Generates briefs, ingests RSS feeds, publishes to DynamoDB
- **API service** (`apps/api`): Serves briefs and chat endpoints
- **Web service** (`apps/web`): Next.js dashboard and chat UI
- **Shared package** (`packages/shared`): Agent definitions, portfolio configs, types

### Current Issues
1. **High failure rate**: 56 failed runs in last 7 days, mostly due to FACTCHECK validation
   - Error pattern: "FACTCHECK: summary has numbers but is missing an evidence tag"
   - Briefs are rejected if they contain numbers without `{{evidence: N}}` tags
2. **Limited sources**: Only using configured RSS feeds per portfolio (see `packages/shared/src/portfolio-sources.ts`)
3. **Missing Google News**: No Google News RSS integration despite being a rich source

### Key Files
- Agent config: `apps/runner/src/agents/agents.yaml`
- Portfolio sources: `packages/shared/src/portfolio-sources.ts`
- Brief validation: `apps/runner/src/publish/validate.ts`
- Factuality checks: `apps/runner/src/publish/factuality.ts`
- LLM prompts: `apps/runner/src/llm/prompts.ts`
- Category prompts: `packages/shared/src/agent-registry.ts`

## Goals

### 1. Simplify Validation Requirements
**Current**: Briefs fail if they contain numbers without evidence tags, or if numbers don't match source content exactly.

**Target**: 
- Allow numbers in summaries/highlights without requiring evidence tags (numbers are often aggregations/analysis)
- Only require evidence tags for specific claims that need source attribution
- Relax numeric matching - allow reasonable inference (e.g., "10%" can come from "increased by approximately 10 percentage points")
- Keep strict validation only for procurement actions and watchlist items

**Files to modify**:
- `apps/runner/src/publish/factuality.ts` - Relax validation rules
- `apps/runner/src/publish/validate.ts` - Update validation logic
- `apps/runner/src/llm/prompts.ts` - Update prompt to clarify when evidence tags are required

### 2. Add Google News RSS Feeds
**Current**: Each portfolio has 5-10 RSS feeds defined in `packages/shared/src/portfolio-sources.ts`

**Target**: Add Google News RSS feeds for each category, region-specific:
- APAC (AU): Google News searches for category keywords + "Australia" or "APAC"
- International (US-MX-LatAm-LNG): Google News searches for category keywords + "US" or "LNG" or "Mexico"

**Google News RSS Format**:
```
https://news.google.com/rss/search?q={query}&hl=en-US&gl=US&ceid=US:en
```

**Query Strategy**:
- Use category-specific keywords (e.g., "drilling services", "OCTG", "decommissioning")
- Add region qualifiers
- Use date filters for recent news (last 24-48 hours)
- Combine multiple queries per category for broader coverage

**Files to modify**:
- `packages/shared/src/portfolio-sources.ts` - Add Google News feeds per portfolio/region
- `apps/runner/src/ingest/rss.ts` - Ensure it handles Google News RSS format correctly
- Consider adding a new function to generate Google News queries dynamically

### 3. Improve Source Diversity
**Current**: Each category has 5-10 static RSS feeds

**Target**: 
- 3-5 Google News RSS feeds per category per region (dynamic queries)
- Keep existing high-quality feeds (Rigzone, EIA, etc.)
- Total: 10-15 sources per category per region

## Implementation Plan

### Step 1: Relax Validation (Priority: High)
1. **Modify `apps/runner/src/publish/factuality.ts`**:
   - Change `validateNumericClaims` to be more lenient
   - Allow numbers in summaries/highlights without evidence tags
   - Only require evidence for specific procurement actions, supplier names, and watchlist items
   - Allow approximate numeric matches (fuzzy matching)

2. **Update `apps/runner/src/publish/validate.ts`**:
   - Reduce severity of FACTCHECK failures
   - Make evidence tags optional for general analysis
   - Keep strict validation for actionable items only

3. **Update prompts in `apps/runner/src/llm/prompts.ts`**:
   - Clarify: "Use evidence tags `{{evidence: N}}` for specific claims, supplier names, and procurement actions. General analysis and aggregated numbers don't require tags."

### Step 2: Add Google News Integration (Priority: High)
1. **Create Google News query builder**:
   - Function to generate category-specific queries
   - Region-aware (AU vs US/International)
   - Time-bounded (last 24-48 hours)

2. **Update `packages/shared/src/portfolio-sources.ts`**:
   - Add `getGoogleNewsFeeds(portfolio: string, region: string): PortfolioSource[]`
   - Generate 3-5 Google News RSS URLs per category/region
   - Use category keywords from agent definitions

3. **Test RSS ingestion**:
   - Verify `apps/runner/src/ingest/rss.ts` handles Google News format
   - Google News RSS uses `<item><title>`, `<item><link>`, `<item><pubDate>` format

### Step 3: Category-Specific Keywords
**For each of the 15 categories, define search keywords**:

1. **Rigs & Integrated Drilling**: "drilling rigs", "offshore drilling", "drilling contracts"
2. **Drilling Services**: "directional drilling", "mud logging", "drilling services"
3. **Wells Materials & OCTG**: "OCTG", "casing", "tubing", "steel pipe"
4. **Completions & Intervention**: "well completion", "fracking", "stimulation"
5. **Plug & Abandonment / Decommissioning**: "decommissioning", "plug abandonment", "P&A"
6. **Subsea, SURF & Offshore**: "subsea", "SURF", "offshore construction"
7. **Projects (EPC/EPCM & Construction)**: "EPC", "EPCM", "oil gas construction"
8. **Major Equipment OEM & LTSA**: "compressor", "turbine", "rotating equipment"
9. **Operations & Maintenance Services**: "oil gas maintenance", "operations services"
10. **MRO & Site Consumables**: "MRO", "valves", "consumables"
11. **Logistics, Marine & Aviation**: "marine logistics", "aviation", "freight"
12. **Site Services & Facilities**: "facilities management", "waste management"
13. **Oil & Gas / LNG Market Dashboard**: "LNG", "natural gas", "oil prices"
14. **IT, Telecom & Cyber**: "cybersecurity", "IT services", "telecom"
15. **Professional Services & HR**: "consulting", "HR services", "professional services"

**Region modifiers**:
- APAC: Add "Australia", "APAC", "Perth", "Asia Pacific"
- International: Add "US", "United States", "Mexico", "LNG", "Gulf of Mexico"

### Step 4: Update Agent Registry
**File**: `packages/shared/src/agent-registry.ts`
- Ensure agent prompts don't over-emphasize evidence tagging
- Focus on actionable intelligence over strict citation requirements

## Technical Details

### Google News RSS Query Examples
```
# APAC - Drilling Services
https://news.google.com/rss/search?q=drilling+services+Australia+OR+APAC&hl=en-US&gl=AU&ceid=AU:en&when=1d

# International - OCTG
https://news.google.com/rss/search?q=OCTG+US+OR+LNG+OR+Mexico&hl=en-US&gl=US&ceid=US:en&when=1d

# APAC - Decommissioning
https://news.google.com/rss/search?q=decommissioning+OR+P%26A+Australia+OR+offshore&hl=en-US&gl=AU&ceid=AU:en&when=1d
```

**Query parameters**:
- `q`: URL-encoded search query
- `hl`: Language (en-US)
- `gl`: Country code (AU for APAC, US for International)
- `ceid`: Country edition ID (AU:en or US:en)
- `when`: Time filter (1d = last day, 7d = last week)

### Validation Relaxation Strategy
**Current strict rules** (in `factuality.ts`):
- Every number must have `{{evidence: N}}`
- Numbers must match source exactly
- All claims need verification

**New relaxed rules**:
- Numbers in summaries/highlights: Optional evidence tags
- Aggregated statistics: Allow inference
- Procurement actions: Still require evidence
- Supplier names: Still require evidence
- Watchlist items: Still require evidence
- Delta/trend statements: Allow analysis labels

### Testing Checklist
1. ✅ Briefs generate without FACTCHECK failures for general analysis
2. ✅ Google News feeds are ingested successfully
3. ✅ Briefs include articles from Google News sources
4. ✅ Evidence tags still present for actionable items
5. ✅ Dashboard shows new briefs after generation
6. ✅ All 15 categories × 2 regions generate successfully

## Expected Outcomes

### Before
- 56 failed runs in 7 days
- Many briefs rejected due to strict validation
- Limited to 5-10 static RSS feeds per category

### After
- <10% failure rate (only for critical errors)
- 10-15 sources per category (including Google News)
- More diverse, recent news coverage
- Briefs publish successfully with actionable intelligence

## Files to Modify (Summary)

1. **`apps/runner/src/publish/factuality.ts`** - Relax validation rules
2. **`apps/runner/src/publish/validate.ts`** - Update validation severity
3. **`apps/runner/src/llm/prompts.ts`** - Update evidence tag requirements in prompts
4. **`packages/shared/src/portfolio-sources.ts`** - Add Google News feed generation
5. **`packages/shared/src/agent-registry.ts`** - Update category prompts if needed
6. **`apps/runner/src/ingest/rss.ts`** - Verify Google News RSS parsing (may need updates)

## Questions to Resolve

1. Should we keep some strict validation for procurement actions, or relax everything?
2. How many Google News queries per category? (Recommend: 3-5)
3. Time window for Google News? (Recommend: last 24-48 hours)
4. Should Google News feeds be added to all categories or specific ones?

## Next Steps After Implementation

1. Deploy updated runner service
2. Trigger a test run: `API_BASE_URL=... ADMIN_TOKEN=... pnpm run run-briefs all`
3. Monitor logs for validation errors
4. Check DynamoDB for published briefs
5. Verify dashboard shows new briefs

---

**Note**: The codebase uses TypeScript, pnpm workspaces, and AWS App Runner for deployment. All changes should maintain backward compatibility with existing briefs in DynamoDB.
