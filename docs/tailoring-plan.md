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

## Progress

Done (June 2026):

- [x] 1.1 Event taxonomy (`packages/shared/src/event-taxonomy.ts`)
- [x] 1.2 Supplier/entity registry (`packages/shared/src/supplier-registry.ts`)
- [x] 1.3 Materiality scoring in ingestion ranking (`apps/runner/src/ingest/materiality.ts`)
- [x] 1.4 Cross-day story threading v1 — title-similarity demotion + "frame as update" prompt
      hint (`apps/runner/src/ingest/similarity.ts`, `apps/runner/src/db/used-urls.ts`)
- [x] 1.5 (partial) Market data credibility: runner snapshot no longer publishes fabricated
      fallback prices in production (`apps/runner/src/market/portfolio-snapshot.ts`). Live data
      remains Yahoo-spark based; EIA/FRED/rig-count adapters still open.
- [x] 1.6 Signal level (act/watch/awareness) derived per brief, persisted, with awareness-day
      context note (`apps/runner/src/run.ts`)
- [x] 2.3 Category framework (cost drivers, contract mechanisms, suppliers, compliance
      triggers) injected into the production brief prompt; event/entity hints per article
- [x] 3.1 Homepage rebuilt as the Today triage board (per-category signal rows, region toggle,
      tabbed headlines, trimmed ticker)
- [x] 3.2 `/morning-scan` → `/`; `/watchlist` → Action Center watchlist tab; nav simplified to
      Today / My Portfolios / Action Center / Assistant
- [x] 3.3 (partial) Brief page diet: signal badge in header, hero image removed, one persona
      panel per brief (CM preferred; VP only for legacy briefs)
- [x] Signal badges on the region briefs table and portfolio dashboard brief lists

Open next:

- [x] Daily email digest per region (env-gated SES; act/watch counts + per-category rows)
      (`apps/runner/src/digest/`)
- [x] CI runs the deterministic smoke suites; route error/404/loading pages; region badges
      corrected to AU / INTL
- [x] Optional site-wide access gate (SITE_ACCESS_GATE; reuses chat-access session via /login)
- [x] Admin quality panel: per-category signal mix, usefulness flags, fallback rate, and token
      spend over 7 days (`/api/admin/quality`)

- [x] 1.5 Market data history adapters: EIA (WTI/Brent/Henry Hub spot), FRED (diesel, steel
      PPI), Baker Hughes US rig count, ACCC LNG netback (env-configured CSV; AU-scoped). Daily
      values stored in the same table (`MARKET#<seriesId>` / `DAY#<yyyy-mm-dd>`), keyed per
      category via `historySeriesId` on the per-portfolio index config. Brief market tiles show
      official week-over-week trend ("w/w −4.0% · EIA"); history-only series (rig count,
      netback) become their own tiles. Env-gated no-op by default (`MARKET_HISTORY_ENABLED` +
      per-provider keys, see docs/env-contract.md); fetch/parse failure yields no data, never
      fabricated values (`apps/runner/src/market/history/`, `apps/runner/src/db/market-history.ts`)
- [x] 2.1 (persistent watchlist) Watchlist items are structured records (id, title, trigger,
      status open/triggered/resolved, evidence link) that carry forward day-to-day. The rich
      writer sees open items with stable ids and proposes `watchlistUpdates`/`watchlistAdditions`;
      deterministic reconciliation migrates legacy freeform watchlists, dedupes by title
      similarity, auto-resolves items stale >14 days, and caps carried items at 10. Brief page
      and Action Center watchlist tab render status; freeform `watchlist` strings stay on the
      record for backward compatibility (`apps/runner/src/watchlist/reconcile.ts`). The lean
      fixed brief structure portion of 2.1 remains open.
- [ ] 2.1 (remaining) Lean fixed brief structure
- [x] 2.4 (v1) Usefulness checks: summary bullets must name an entity or carry a concrete
      figure; generic filler and rationale without a "because" trigger are flagged. Non-blocking
      (logged to qualityReport), so weak briefs are measurable without re-creating the old
      FACTCHECK failure storms (`apps/runner/src/publish/usefulness.ts`)
- [ ] 2.5 Weekly deep-dive edition
- [ ] Phase 4 personalization (profile, supplier pages, feedback loop, entity-grounded chat)

## Observations backlog (quality watch-items)

Noticed while working; not yet changed:

1. **Stale docs** — `MODEL_AND_CATEGORIES.md` says the writer defaults to gpt-4o; the code
   default is `gpt-5-mini` (`BRIEF_WRITER_MODEL` in `apps/runner/src/llm/openai.ts`). Several
   root-level investigation files (`ROOT_CAUSE.md`, `JAN21_INVESTIGATION.md`,
   `DIAGNOSIS_MISSING_BRIEFS.md`, `BRIEF_DEPTH_FIXES.md`, …) are debugging session debris and
   could move to `docs/archive/`.
2. ~~**Three ticker components** remain (`LiveMarketTicker`, `PortfolioMarketTicker`,
   `CategoryMarketTicker`) — consolidate into one with a symbols prop.~~ Done (June 2026):
   one `MarketTicker` with `portfolio` / `symbols` / `variant` props; `CategoryMarketTicker`
   was unused and its `CATEGORY_INDICES` config was dead — both removed.
3. **`inferSignals` keyword chips** in `BriefsTable` are now partially redundant with real
   signal badges; retire once all live briefs carry `signalLevel`.
4. **`/category/[category]`** is still a thin wrapper around portfolio listing; fold into
   `/portfolios` when convenient.
5. **Chat context not persisted** — region/portfolio selections reset between pages; a tiny
   localStorage preference would carry the user's categories everywhere (feeds Phase 4).
6. **`executive-dashboard` smoke test is network-dependent** (live Yahoo call); it fails in
   sandboxes without market access. Inject a fixture or set placeholder env in test runs.
7. **`isThinCategoryDay` content-length heuristic** overlaps with the new signal levels;
   unify so "thin" and "awareness" don't drift apart.
8. **Supplier registry is hand-seeded** — worth a domain review pass per category (names,
   aliases, AU vs Americas scoping) to sharpen entity matching further.
9. **Baker Hughes rig count parser is structure-dependent** — it reads the IR "Rig Count
   Overview" HTML table and intentionally yields nothing if the page layout changes; worth a
   periodic check that points are still landing once enabled. AEMO (Vic gas / GBB) was left out
   of the v1 adapters: its NEMWEB CSV layouts could not be verified from the sandbox; revisit
   with a captured sample file.
10. **`fetchPortfolioSnapshot` is portfolio-keyed, not region-keyed** — region scoping for
    history-backed tiles (e.g. AU-only ACCC netback) lives in the enrichment step; if snapshots
    ever become region-aware, fold that in.
11. **Watchlist evidence links into old briefs** — structured watchlist items link to the
    original article URL; a future nicety is linking to the brief day where the item was opened.
