import assert from "node:assert/strict";
import {
  WATCHLIST_EXPIRY_DAYS,
  WATCHLIST_MAX_OPEN_ITEMS,
  carriedWatchlistItems,
  cleanWatchlistText,
  reconcileWatchlist,
  watchlistItemId
} from "./reconcile.js";

// --- text cleanup / id stability ---
assert.equal(
  cleanWatchlistText("Watch Subsea 7 vessel availability [2] (analysis)"),
  "Watch Subsea 7 vessel availability"
);
assert.equal(
  cleanWatchlistText("HRC pricing follow-through (source: articleIndex 3)"),
  "HRC pricing follow-through"
);
assert.equal(
  watchlistItemId("Watch Subsea 7 vessel availability"),
  watchlistItemId("watch SUBSEA 7 vessel availability!"),
  "Ids must be stable across formatting differences"
);
assert.match(watchlistItemId("anything"), /^wl-[0-9a-f]{10}$/);

// --- migration from legacy freeform watchlists ---
const legacyBrief = {
  publishedAt: "2026-06-09T21:00:00.000Z",
  briefDay: "2026-06-09",
  watchlist: [
    "Monitor SLB crew reallocation to AU projects [1]",
    "Monitor SLB crew reallocation to AU projects [1]",
    "Watch HRC steel price follow-through (analysis)"
  ]
};
const migrated = carriedWatchlistItems(legacyBrief);
assert.equal(migrated.length, 2, "Duplicate legacy strings should migrate once");
assert.equal(migrated[0].status, "open");
assert.equal(migrated[0].openedAt, "2026-06-09");
assert(!migrated[0].title.includes("[1]"), "Citation tags must be stripped");

// Resolved structured items do not carry forward.
const carried = carriedWatchlistItems({
  publishedAt: "2026-06-09T21:00:00.000Z",
  briefDay: "2026-06-09",
  watchlistItems: [
    { id: "wl-aaaaaaaaaa", title: "Open item", trigger: "t", status: "open", openedAt: "2026-06-05", updatedAt: "2026-06-08" },
    { id: "wl-bbbbbbbbbb", title: "Done item", trigger: "t", status: "resolved", openedAt: "2026-06-01", updatedAt: "2026-06-08", resolvedAt: "2026-06-08" }
  ]
});
assert.deepEqual(carried.map((item) => item.id), ["wl-aaaaaaaaaa"]);

// --- day 1: freeform-only writer output becomes structured open items ---
const day1 = reconcileWatchlist({
  previousBrief: null,
  freeformWatchlist: ["Watch Valaris dayrate resets on AU jackups [2]"],
  briefDay: "2026-06-09"
});
assert.equal(day1.length, 1);
assert.equal(day1[0].status, "open");
assert.equal(day1[0].openedAt, "2026-06-09");
assert.equal(day1[0].title, "Watch Valaris dayrate resets on AU jackups");

// --- day 2: items carry forward; writer updates and additions apply ---
const day1Brief = { publishedAt: "2026-06-09T21:00:00.000Z", briefDay: "2026-06-09", watchlistItems: day1 };
const valarisId = day1[0].id;
const day2 = reconcileWatchlist({
  previousBrief: day1Brief,
  proposals: {
    updates: [
      { id: valarisId, status: "triggered", note: "Valaris confirmed a 20% dayrate reset on two jackups.", evidenceUrl: "https://example.com/valaris", evidenceTitle: "Valaris resets dayrates" },
      { id: "wl-hallucinated", status: "resolved", note: "Should be ignored entirely." }
    ],
    additions: [{ title: "Woodside subsea tender award timing", trigger: "Award announced or slipped past Q3", evidenceUrl: "https://example.com/woodside" }]
  },
  freeformWatchlist: ["This freeform string must be ignored when structured proposals exist"],
  briefDay: "2026-06-10"
});
assert.equal(day2.length, 2, "Hallucinated ids and freeform must not create items");
const triggered = day2.find((item) => item.id === valarisId);
assert.equal(triggered?.status, "triggered");
assert.equal(triggered?.updatedAt, "2026-06-10");
assert.equal(triggered?.openedAt, "2026-06-09", "openedAt survives updates");
assert.equal(triggered?.evidenceUrl, "https://example.com/valaris");
assert.match(triggered?.statusNote ?? "", /dayrate reset/);
const added = day2.find((item) => item.title.includes("Woodside"));
assert.equal(added?.status, "open");
assert.equal(added?.openedAt, "2026-06-10");
assert.equal(day2[0].status, "triggered", "Triggered items sort first");

// --- re-proposing a similar item refreshes it instead of duplicating ---
const day3 = reconcileWatchlist({
  previousBrief: { publishedAt: "2026-06-10T21:00:00.000Z", briefDay: "2026-06-10", watchlistItems: day2 },
  proposals: {
    updates: [],
    additions: [{ title: "Woodside subsea tender award", trigger: "Award announced" }]
  },
  briefDay: "2026-06-11"
});
const woodsideItems = day3.filter((item) => item.title.toLowerCase().includes("woodside"));
assert.equal(woodsideItems.length, 1, "Similar additions must merge into the existing item");
assert.equal(woodsideItems[0].updatedAt, "2026-06-11");
assert.equal(woodsideItems[0].openedAt, "2026-06-10");

// --- resolution shows on the day it happens, then drops off ---
const resolvedDay = reconcileWatchlist({
  previousBrief: { publishedAt: "2026-06-10T21:00:00.000Z", briefDay: "2026-06-10", watchlistItems: day2 },
  proposals: { updates: [{ id: valarisId, status: "resolved", note: "Reset confirmed and priced into the category plan." }], additions: [] },
  briefDay: "2026-06-11"
});
const resolved = resolvedDay.find((item) => item.id === valarisId);
assert.equal(resolved?.status, "resolved");
assert.equal(resolved?.resolvedAt, "2026-06-11");
const dayAfter = reconcileWatchlist({
  previousBrief: { publishedAt: "2026-06-11T21:00:00.000Z", briefDay: "2026-06-11", watchlistItems: resolvedDay },
  freeformWatchlist: [],
  briefDay: "2026-06-12"
});
assert(!dayAfter.some((item) => item.id === valarisId), "Resolved items must not carry to the next day");

// --- stale items auto-expire ---
const stale = reconcileWatchlist({
  previousBrief: {
    publishedAt: "2026-06-09T21:00:00.000Z",
    briefDay: "2026-06-09",
    watchlistItems: [
      { id: "wl-stale00000", title: "Stale watch item", trigger: "t", status: "open", openedAt: "2026-05-01", updatedAt: "2026-05-20" }
    ]
  },
  freeformWatchlist: [],
  briefDay: "2026-06-10"
});
const expired = stale.find((item) => item.id === "wl-stale00000");
assert.equal(expired?.status, "resolved");
assert.match(expired?.statusNote ?? "", new RegExp(`${WATCHLIST_EXPIRY_DAYS} days`));

// --- the carried set is capped ---
const many = Array.from({ length: 15 }, (_, idx) => ({
  id: `wl-cap${String(idx).padStart(7, "0")}`,
  title: `Distinct topic ${idx} entirely unrelated subject ${idx * 7}`,
  trigger: `Trigger condition number ${idx}`,
  status: "open" as const,
  openedAt: "2026-06-08",
  updatedAt: "2026-06-09"
}));
const capped = reconcileWatchlist({
  previousBrief: { publishedAt: "2026-06-09T21:00:00.000Z", briefDay: "2026-06-09", watchlistItems: many },
  freeformWatchlist: [],
  briefDay: "2026-06-10"
});
assert(
  capped.filter((item) => item.status !== "resolved").length <= WATCHLIST_MAX_OPEN_ITEMS,
  "Open items must be capped"
);

console.log("watchlist.smoke passed");
