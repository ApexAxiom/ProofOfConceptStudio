import crypto from "node:crypto";
import { BriefPost, WatchlistItem, WatchlistItemStatus, WatchlistProposals } from "@proof/shared";
import { titleTokens, tokenSetSimilarity } from "../ingest/similarity.js";

/**
 * Persistent watchlist reconciliation.
 *
 * Watchlist items are structured records that carry forward day-to-day
 * instead of regenerating. Each run merges:
 *   1. yesterday's open/triggered items (legacy freeform strings are
 *      migrated with deterministic ids so prompts and reconciliation agree),
 *   2. the writer's structured updates/additions (rich writer), and
 *   3. today's freeform watchlist strings (deterministic/legacy writers),
 * then auto-resolves items that have gone stale and caps the carried set.
 *
 * Today's freeform `watchlist` strings on the brief are left untouched for
 * backward compatibility with old briefs, claims, and the digest.
 */

export const WATCHLIST_EXPIRY_DAYS = 14;
export const WATCHLIST_MAX_OPEN_ITEMS = 10;
const MATCH_THRESHOLD = 0.6;
const TITLE_MAX_LENGTH = 120;

/** Strips citation tags ("[2]", "(source: articleIndex 3)", "(analysis)") from freeform items. */
export function cleanWatchlistText(text: string): string {
  return (text ?? "")
    .replace(/\s*\[\d+\]/g, " ")
    .replace(/\s*\((?:source:\s*articleIndex\s*\d+|analysis)\)/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function clipTitle(text: string): string {
  if (text.length <= TITLE_MAX_LENGTH) return text;
  return `${text.slice(0, TITLE_MAX_LENGTH - 3).trim()}...`;
}

/** Deterministic id so the same item gets the same id in prompts and reconciliation. */
export function watchlistItemId(title: string): string {
  const normalized = Array.from(titleTokens(title)).sort().join(" ") || title.trim().toLowerCase();
  return `wl-${crypto.createHash("sha1").update(normalized).digest("hex").slice(0, 10)}`;
}

function toDayKey(value: string | undefined, fallback: string): string {
  const day = (value ?? "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : fallback;
}

function dayDiff(earlierDay: string, laterDay: string): number {
  const earlier = Date.parse(`${earlierDay}T00:00:00.000Z`);
  const later = Date.parse(`${laterDay}T00:00:00.000Z`);
  if (Number.isNaN(earlier) || Number.isNaN(later)) return 0;
  return Math.round((later - earlier) / (24 * 60 * 60 * 1000));
}

type PreviousBriefWatchlist = Pick<BriefPost, "watchlist" | "watchlistItems" | "briefDay" | "publishedAt">;

/**
 * Normalizes the previous brief's watchlist into structured items that are
 * still being watched (resolved items do not carry forward). Old briefs with
 * only freeform strings are migrated with deterministic ids.
 */
export function carriedWatchlistItems(previousBrief: PreviousBriefWatchlist | null | undefined): WatchlistItem[] {
  if (!previousBrief) return [];
  const previousDay = toDayKey(previousBrief.briefDay ?? previousBrief.publishedAt, "");

  if (previousBrief.watchlistItems?.length) {
    return previousBrief.watchlistItems
      .filter((item) => item && item.status !== "resolved" && item.title && item.id)
      .map((item) => ({
        ...item,
        openedAt: toDayKey(item.openedAt, previousDay || item.updatedAt),
        updatedAt: toDayKey(item.updatedAt, previousDay || item.openedAt)
      }));
  }

  const migrated: WatchlistItem[] = [];
  const seen = new Set<string>();
  for (const raw of previousBrief.watchlist ?? []) {
    const cleaned = cleanWatchlistText(raw);
    if (!cleaned) continue;
    const id = watchlistItemId(cleaned);
    if (seen.has(id)) continue;
    seen.add(id);
    migrated.push({
      id,
      title: clipTitle(cleaned),
      trigger: cleaned,
      status: "open",
      openedAt: previousDay,
      updatedAt: previousDay
    });
  }
  // A previous brief without a parseable day cannot anchor expiry windows.
  return migrated.filter((item) => item.openedAt && item.updatedAt);
}

export interface ReconcileWatchlistParams {
  previousBrief?: PreviousBriefWatchlist | null;
  /** Structured proposals from the rich writer. When present they win over freeform strings. */
  proposals?: WatchlistProposals;
  /** Today's freeform watchlist strings (deterministic/legacy writer fallback). */
  freeformWatchlist?: string[];
  /** Today's brief day (YYYY-MM-DD). */
  briefDay: string;
}

const STATUS_ORDER: Record<WatchlistItemStatus, number> = { triggered: 0, open: 1, resolved: 2 };

export function reconcileWatchlist(params: ReconcileWatchlistParams): WatchlistItem[] {
  const briefDay = toDayKey(params.briefDay, params.briefDay);
  const items = carriedWatchlistItems(params.previousBrief).map((item) => ({ ...item }));
  const byId = new Map(items.map((item) => [item.id, item]));

  const findSimilar = (title: string): WatchlistItem | undefined => {
    const candidate = titleTokens(title);
    if (candidate.size === 0) return undefined;
    return items.find(
      (item) =>
        tokenSetSimilarity(candidate, titleTokens(item.title)) >= MATCH_THRESHOLD ||
        tokenSetSimilarity(candidate, titleTokens(item.trigger)) >= MATCH_THRESHOLD
    );
  };

  const addOrRefresh = (input: { title: string; trigger: string; evidenceUrl?: string; evidenceTitle?: string }) => {
    const title = clipTitle(cleanWatchlistText(input.title));
    const trigger = cleanWatchlistText(input.trigger) || title;
    if (!title) return;

    const existing = byId.get(watchlistItemId(title)) ?? findSimilar(title);
    if (existing) {
      // Same condition re-proposed: refresh recency/evidence, keep history.
      existing.updatedAt = briefDay;
      if (input.evidenceUrl) {
        existing.evidenceUrl = input.evidenceUrl;
        existing.evidenceTitle = input.evidenceTitle;
      }
      return;
    }

    const item: WatchlistItem = {
      id: watchlistItemId(title),
      title,
      trigger,
      status: "open",
      openedAt: briefDay,
      updatedAt: briefDay,
      ...(input.evidenceUrl ? { evidenceUrl: input.evidenceUrl, evidenceTitle: input.evidenceTitle } : {})
    };
    items.push(item);
    byId.set(item.id, item);
  };

  // 1. Writer status updates apply only to known carried ids — a hallucinated
  //    id can never invent or resurrect an item.
  for (const update of params.proposals?.updates ?? []) {
    const item = byId.get(update.id);
    if (!item) continue;
    item.status = update.status;
    item.updatedAt = briefDay;
    if (update.note) item.statusNote = update.note;
    if (update.evidenceUrl) {
      item.evidenceUrl = update.evidenceUrl;
      item.evidenceTitle = update.evidenceTitle;
    }
    if (update.status === "triggered" || update.status === "resolved") {
      item.resolvedAt = update.status === "resolved" ? briefDay : item.resolvedAt;
    }
  }

  // 2. New items: structured additions when the writer provided them,
  //    otherwise fall back to today's freeform strings.
  if (params.proposals) {
    for (const addition of params.proposals.additions) {
      addOrRefresh(addition);
    }
  } else {
    for (const raw of params.freeformWatchlist ?? []) {
      const cleaned = cleanWatchlistText(raw);
      if (cleaned) addOrRefresh({ title: cleaned, trigger: cleaned });
    }
  }

  // 3. Auto-expire stale items so the list cannot grow into noise.
  for (const item of items) {
    if (item.status === "resolved") continue;
    if (dayDiff(item.updatedAt, briefDay) > WATCHLIST_EXPIRY_DAYS) {
      item.status = "resolved";
      item.resolvedAt = briefDay;
      item.statusNote = `Auto-resolved: no new signal for ${WATCHLIST_EXPIRY_DAYS} days.`;
    }
  }

  // 4. Cap carried items (keep triggered, then most recently updated).
  const active = items
    .filter((item) => item.status !== "resolved")
    .sort(
      (a, b) =>
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
        b.updatedAt.localeCompare(a.updatedAt) ||
        b.openedAt.localeCompare(a.openedAt)
    )
    .slice(0, WATCHLIST_MAX_OPEN_ITEMS);
  const resolvedToday = items.filter((item) => item.status === "resolved" && item.resolvedAt === briefDay);

  return [...active, ...resolvedToday];
}
