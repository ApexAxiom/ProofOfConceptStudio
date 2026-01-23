# Category Manager Decision Brief v2

## Recon + Repro (local)
- **Fetch by postId:** `node scripts/fetch-brief-by-id.mjs <postId>` (uses `API_BASE_URL` or defaults to `http://localhost:8080`).  
- **Brief page:** open `/brief?postId=<id>` in the web app once API is running locally.

### Before (screenshot description)
The current brief detail page leads with the Executive Summary and immediately renders claim evidence, which visually pulls attention toward verification over decisions. Action items and supplier implications are secondary and require scrolling, while cmSnapshot/vpSnapshot content (when present) is not surfaced prominently. The title appears both in the summary bar and hero, creating redundancy.

## What changes in v2 (Decision-first structure)
### Above the fold (worth the first 60 seconds)
**1-Minute Decision Panel**
- **What changed** (deltaSinceLastRun, 1–3 bullets)
- **Do Next** (merged procurement actions + VP recommended actions, 2–5 bullets)
- **Supplier Radar** (CM supplier signals with next steps)
- **Negotiation Levers** (explicit commercial mechanism)
- **Risk & Triggers** (VP risk register, 2–5 items)
- **Market Snapshot** tiles (real numbers from portfolio indices)

**Confidence & Credibility**
- One line: **Evidence-backed: X | Analysis: Y**
- Evidence + Sources are **collapsed by default** (audit mode only)

### Below the fold (supporting detail)
- **Top Stories** (1–3 articles, with key facts + why it matters)
- **Market Indicators** (collapsed by default)
- **Evidence & Sources** (collapsed)

## Why it’s better for Category Managers
- **Action-first:** CM/VP snapshots and the decision panel surface the “what to do today” content instead of forcing evidence review.
- **Supplier impact clarity:** Supplier Radar + Negotiation Levers highlight immediate commercial implications.
- **Noise reduction:** Evidence is still available, but it no longer dominates the reading flow.
- **Market signal clarity:** Hard numbers are shown as tiles (separate from prose) to avoid evidence collisions.

## Compatibility notes
- Old briefs render with graceful fallbacks (missing decisionSummary, cmSnapshot, vpSnapshot, marketSnapshot).
- Evidence integrity stays strict for procurement actions and watchlist items.
