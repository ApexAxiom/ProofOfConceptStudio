# Tailoring Plan — Category Management Intelligence Hub

Status: **approved** (2026-06-10). This is the working plan for making the site more tailored to
oil & gas procurement category managers and reducing noise.

## Product principle

A category manager opens the hub for 90 seconds with one question: *"did anything happen in my
market that changes what I should do?"* Every feature either answers that faster or is noise.

Through the oil & gas supply chain lens, the system should think in terms of **events that move
categories**, not keyword matches:

- contract awards / tenders
- supplier consolidation, M&A, market entry/exit
- capacity and lead-time shifts (rigs, vessels, mills, yards, crews)
- price / index moves (dayrates, HRC steel, freight, LNG netback)
- regulatory & trade changes (NOPSEMA/NOPTA, BSEE/BOEM, tariffs, local content)
- incidents / force majeure
- labor actions
- supplier financial distress
- demand signals (FIDs, project milestones)

## Locked decisions

1. **One brief per category per region stays.** Each of the 14 categories is managed by one
   person and keeps its own daily brief, plus the executive/market-dashboard overview brief.
   The redesign changes what is *inside* each brief, never the per-category cadence.
2. **Low-signal days still publish something useful.** When nothing material happened, the brief
   becomes a short awareness read: 1–2 interesting articles framed as "worth knowing", clearly
   badged as low signal — no padded actions, no manufactured urgency. Signal levels:
   `act` / `watch` / `awareness`.
3. **The brief is the Category Manager product.** VP/leadership content moves to a
   cross-portfolio rollup (Action Center), instead of duplicating a second persona panel inside
   every brief.

## Phase 1 — Make the signal real (pipeline)

1. **Event taxonomy classification** (`packages/shared/src/event-taxonomy.ts`)
   Rules-based classifier tags every ingested article with an event type from the taxonomy above.
   Stored on the article, shown as a badge, used in ranking.
2. **Supplier/entity registry** (`packages/shared/src/supplier-registry.ts`)
   Region-aware entity lists per category (suppliers + operators as demand-side entities),
   built on `AGENT_FRAMEWORKS.keySuppliers` with alias matching (e.g. SLB/Schlumberger).
3. **Materiality scoring replaces bare keyword scoring** (`apps/runner/src/ingest/materiality.ts`)
   `score = eventTypeWeight + entityScore + keywordScore + recencyBonus − qualityPenalty`.
   A tender award naming a registry supplier in-region outranks generic market commentary.
4. **Cross-day dedup + story threading** — similarity matching against the last ~14 days;
   repeats are suppressed or promoted as developing-story updates so "what changed" is computed
   truth, not prompt output. *(follow-up within Phase 1)*
5. **Live market data adapter** — EIA, FRED, Baker Hughes rig count, ACCC LNG netback/AEMO;
   2–4 relevant indices per category with stored daily snapshots; remove hard-coded fallback
   prices (show "unavailable" rather than fiction). *(follow-up within Phase 1)*
6. **Signal level on every brief** — `act` / `watch` / `awareness`, derived from the materiality
   of the selected articles, persisted on the brief record, surfaced in the UI.

## Phase 2 — Rebuild the brief around decisions (content)

1. Fixed lean structure: What changed → Market state → Top signals (max 3, entity-named,
   event-badged, with a category-specific "so what") → Actions (only when warranted; "no action
   needed" is valid) → Watchlist (persistent structured items carried day-to-day).
2. One persona per surface (CM in briefs; VP rollup in Action Center).
3. Inject the per-category framework (cost drivers, contract models, key suppliers, compliance
   triggers from `AGENT_FRAMEWORKS`) into the production brief prompt — today it is only used
   for chat.
4. Validation focused on usefulness: every signal names an entity, contains a number or date,
   and states a category-specific implication — replacing citation-tag pedantry.
5. Weekly deep-dive (Monday): 7-day rollup per category — price trends, supplier moves, tender
   pipeline.

## Phase 3 — Cut the UI to one path (web)

1. Homepage becomes "My categories today": per-category status rows with signal badges
   (act / watch / awareness), top 3 cross-portfolio signals, one compact ticker.
2. Delete/merge: fold `/morning-scan` into the homepage; replace the `/watchlist` stub with the
   real persistent watchlist; remove the legacy `/[region]/[portfolio]` redirect and the
   `/category` thin wrapper; collapse the 3 homepage news sections into one tabbed block; one
   ticker component.
3. Brief page diet: decision panel above the fold, source explorer behind one "Audit" tab,
   hero images removed or thumbnail-sized, one snapshot panel, max ~3 expandables.
4. Navigation: Today · Categories · Actions · Chat (+ Admin).

## Phase 4 — Tailoring & feedback

1. User profile (categories owned, region, contracted suppliers) personalizes ranking, homepage,
   watchlist.
2. Supplier pages: per-entity event history across all categories.
3. Feedback loop: 👍/👎 per signal feeds materiality weights.
4. Chat grounded in entity history.

## Sequencing

Phase 1 → 2 → 3 → 4. Quick wins that can land alongside Phase 1: homepage consolidation,
brief-page diet, low-signal handling, real market data.
