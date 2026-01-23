# Brief Generation Depth Fixes - Critical Issue Resolution

## Date: January 23, 2026

## Problem Statement
Briefs were generating with "hollow" content - lacking the depth and category management insights expected from an intelligence website. The content was too generic and not leveraging the full article content available.

## Root Causes Identified

### 1. **CRITICAL: Evidence Extraction Too Restrictive** ⚠️
- **Issue**: `extractEvidenceExcerpts()` was only extracting:
  - First 3 sentences
  - Limited sentences with numbers
  - Limited sentences with supplier names
  - Maximum 10 excerpts total
- **Impact**: LLM was receiving only tiny snippets of article content, leading to generic, shallow briefs
- **Fix**: Expanded extraction to:
  - First 8 sentences (increased from 3)
  - ALL sentences with numeric data (critical for category management)
  - ALL sentences mentioning suppliers/companies
  - Sentences with procurement/category terms (contracts, awards, deals, etc.)
  - Sentences with market impact terms (demand, supply, capacity, etc.)
  - Maximum 40 excerpts (increased from 10) - **4x more content**

### 2. **Max Tokens Too Low**
- **Issue**: `max_tokens: 3000` was limiting comprehensive briefs, especially with vpSnapshot and cmSnapshot
- **Fix**: Increased to `max_tokens: 4000` to allow more comprehensive outputs

### 3. **Content Quality Threshold Too High**
- **Issue**: `MIN_CONTENT_LEN = 400` was filtering out articles with good but shorter content
- **Fix**: Reduced to `MIN_CONTENT_LEN = 300` to allow more articles

### 4. **Prompt Instructions Lacked Depth Emphasis**
- **Issue**: Prompts didn't strongly emphasize using specific details from evidence excerpts
- **Fix**: Added explicit instructions:
  - "Use specific facts from evidence excerpts"
  - "Reference actual numbers, company names, contract details"
  - "Avoid generic summaries"
  - "Extract procurement insights"
  - Added "EVIDENCE USAGE INSTRUCTIONS" section in prompt

## Files Modified

1. **`apps/runner/src/llm/prompts.ts`**
   - Expanded `extractEvidenceExcerpts()` function (4x more content)
   - Added depth requirements to prompt
   - Added evidence utilization instructions
   - Enhanced final checklist

2. **`apps/runner/src/llm/openai.ts`**
   - Increased `max_tokens` from 3000 to 4000

3. **`apps/runner/src/llm/category-manager-prompt.ts`**
   - Added critical depth requirements to briefContent instructions
   - Enhanced categoryImportance requirements with specificity emphasis

4. **`apps/runner/src/llm/writing-guide.ts`**
   - Added critical depth requirement to articleBriefs rules

5. **`apps/runner/src/ingest/fetch.ts`**
   - Reduced `MIN_CONTENT_LEN` from 400 to 300

6. **`apps/runner/src/run.ts`**
   - Added logging for article content lengths to help diagnose issues

## Expected Improvements

### Before
- Briefs with 10 evidence excerpts max
- Generic statements like "market conditions may impact"
- Limited use of specific facts from articles
- Shallow category management insights

### After
- Briefs with up to 40 evidence excerpts (4x more context)
- Specific references to actual suppliers, contracts, prices, dates
- Deep category management insights with procurement implications
- Actionable intelligence that demonstrates thorough analysis

## Testing Recommendations

1. **Run a test brief generation**:
   ```bash
   pnpm run:apac  # or pnpm run:international
   ```

2. **Verify in generated briefs**:
   - Evidence excerpts show 20-40 items per article (not just 10)
   - Brief content references specific facts (company names, numbers, dates)
   - Category importance statements are specific, not generic
   - Briefs demonstrate deep understanding of source material

3. **Check logs**:
   - Article content lengths should be logged
   - Verify articles are being properly extracted

## Automatic Scheduling Status

The EventBridge scheduler is configured:
- **Schedule**: `briefs-daily-all-categories`
- **Cron**: `cron(0 11 * * ? *)` (11:00 UTC / 5:00 AM CST / 11:00 PM AWST previous day)
- **Target**: Runner service `/cron` endpoint
- **Status**: Should be ENABLED (verify in AWS Console)

To verify automatic runs are working:
1. Check AWS EventBridge Scheduler console
2. Check CloudWatch logs for runner service
3. Check DynamoDB for recent brief publications

## Next Steps

1. **Deploy changes** to AWS App Runner
2. **Monitor first automatic run** after deployment
3. **Review generated briefs** for depth and specificity
4. **Adjust if needed** based on results

## Notes

- These changes maintain backward compatibility
- No breaking changes to data structures
- Validation rules remain the same (already relaxed in previous updates)
- All existing briefs in DynamoDB remain valid
