# Improvements Summary: Category Brief Generation

## Changes Made

### 1. Relaxed Duplicate Filtering Rules ✅
- **Reduced lookback period**: Changed from 7 days to 3 days across all categories
- **Category-specific filtering**: Duplicate filtering is already portfolio-specific, meaning:
  - ✅ Same article CAN be used across different categories
  - ✅ Same article CANNOT be reused within the same category (prevents duplicates)
- **Updated default fallback**: Changed default `lookbackDays` from 7 to 3 in code

**Files Modified:**
- `apps/runner/src/agents/agents.yaml` - All categories now use `lookbackDays: 3`
- `apps/runner/src/ingest/fetch.ts` - Default fallback changed to 3 days
- `apps/runner/src/db/used-urls.ts` - Added documentation explaining category-specific filtering

### 2. Enhanced Source Coverage ✅
Added more fallback feeds for categories that might be struggling:

**IT/Cyber Category:**
- Added: BleepingComputer, The Hacker News, CSO Online, Cybersecurity Dive, Industrial Cyber
- Total fallback feeds: 8 (up from 3)

**Professional Services:**
- Added: HR Dive, SHRM News, Accounting Today
- Total fallback feeds: 5 (up from 2)

**Steel/Materials:**
- Added: American Iron and Steel Institute, World Oil
- Total fallback feeds: 5 (up from 3)

**Facilities:**
- Added: Facility Executive, Waste360, EHS Today
- Total fallback feeds: 5 (up from 2)

**Files Modified:**
- `apps/runner/src/ingest/fetch.ts` - Enhanced fallback feed arrays

### 3. Strengthened Domain Expertise Emphasis ✅
Enhanced AI agent prompts to be more explicit about category-specific focus:

**Changes:**
- Added explicit statement: "You are an expert [Category] Category Management Analyst specializing exclusively in this category"
- Added: "You are a domain expert focused ONLY on [Category] - analyze news through the lens of this specific category's procurement needs"
- Added: "IMPORTANT: Focus exclusively on [Category]. Even if an article covers multiple categories, analyze it only from the [Category] perspective."

**Files Modified:**
- `packages/shared/src/agent-registry.ts` - Enhanced `buildAgentSystemPrompt` function

### 4. Documentation Improvements ✅
- Added clear comments explaining that duplicate filtering is category-specific
- Documented that cross-category article reuse is intentional and allowed
- Clarified that each category's AI agent analyzes news from their own domain perspective

## How It Works Now

### Duplicate Filtering Logic:
1. **Within Category**: Articles used in the last 3 days for a specific category cannot be reused in that same category
2. **Across Categories**: The same article CAN be used by different categories, as each analyzes it from their domain perspective
3. **Example**: An article about "cyber attack on oil infrastructure" can be used by:
   - IT category (cyber security perspective)
   - Logistics category (supply chain disruption perspective)
   - Operations category (operational impact perspective)

### Source Coverage:
1. **Primary Feeds**: Each category has its own configured feeds in `agents.yaml`
2. **Fallback Feeds**: If primary feeds don't provide enough articles, fallback feeds are used
3. **Progressive Relaxation**: If still not enough articles, the history filter is progressively relaxed

### Domain Expertise:
- Each AI agent is explicitly instructed to be an expert in their specific category
- Agents analyze news exclusively from their category's procurement perspective
- Even if an article covers multiple topics, each agent focuses only on their domain

## Expected Impact

1. **More Briefs Generated**: 
   - Reduced lookback period (7→3 days) means more articles available
   - Better fallback feeds mean more source coverage
   - Cross-category reuse means articles aren't wasted

2. **Better Category Focus**:
   - Enhanced prompts ensure each agent stays in their domain
   - Articles analyzed from category-specific perspective
   - No cross-contamination between category analyses

3. **Improved Coverage for Struggling Categories**:
   - IT category now has 8 fallback feeds (was 3)
   - Professional Services has 5 fallback feeds (was 2)
   - All categories have better source diversity

## Next Steps

1. **Monitor Results**: Run the diagnostic script to see if more briefs are being generated
2. **Check IT Category**: Verify IT category is now generating briefs with improved source coverage
3. **Review Briefs**: Ensure each category's briefs are focused on their domain
4. **Adjust as Needed**: If categories still struggle, consider:
   - Adding more primary feeds to `agents.yaml`
   - Further reducing lookback period for specific categories
   - Adding more category-specific fallback feeds

## Diagnostic Commands

```bash
# Check category coverage
pnpm exec tsx scripts/check-category-coverage.ts

# Comprehensive diagnostics
pnpm exec tsx scripts/diagnose-missing-briefs.ts
```
