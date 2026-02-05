import { promises as fs } from "node:fs";
import path from "node:path";
import { RegionSlug } from "@proof/shared";

export type FeedAttemptStatus = "ok" | "empty" | "error";

export interface FeedAttempt {
  url: string;
  name: string;
  agentId: string;
  region: RegionSlug;
  checkedAt: string;
  status: FeedAttemptStatus;
  itemCount: number;
  error?: string;
}

export interface FeedHealthEntry {
  url: string;
  name: string;
  lastAgentId: string;
  lastRegion: RegionSlug;
  lastCheckedAt: string;
  lastStatus: FeedAttemptStatus;
  lastError?: string;
  lastSuccessAt?: string;
  consecutiveFailures: number;
  consecutiveEmpty: number;
  consecutiveSuccess: number;
  totalChecks: number;
  totalItems: number;
}

interface FeedHealthStore {
  updatedAt: string;
  entries: Record<string, FeedHealthEntry>;
}

const CACHE_DIR = path.join(process.cwd(), ".cache");
const CACHE_FILE = path.join(CACHE_DIR, "feed-health.json");

function normalizeUrl(url: string): string {
  try {
    return new URL(url).toString();
  } catch {
    return url.trim();
  }
}

async function readStore(): Promise<FeedHealthStore> {
  try {
    const raw = await fs.readFile(CACHE_FILE, "utf-8");
    const parsed = JSON.parse(raw) as FeedHealthStore;
    if (!parsed || typeof parsed !== "object" || !parsed.entries) {
      return { updatedAt: new Date().toISOString(), entries: {} };
    }
    return parsed;
  } catch {
    return { updatedAt: new Date().toISOString(), entries: {} };
  }
}

async function writeStore(store: FeedHealthStore): Promise<void> {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(CACHE_FILE, JSON.stringify(store, null, 2), "utf-8");
}

function nextEntry(previous: FeedHealthEntry | undefined, attempt: FeedAttempt): FeedHealthEntry {
  const base: FeedHealthEntry = previous ?? {
    url: normalizeUrl(attempt.url),
    name: attempt.name,
    lastAgentId: attempt.agentId,
    lastRegion: attempt.region,
    lastCheckedAt: attempt.checkedAt,
    lastStatus: attempt.status,
    lastError: undefined,
    lastSuccessAt: undefined,
    consecutiveFailures: 0,
    consecutiveEmpty: 0,
    consecutiveSuccess: 0,
    totalChecks: 0,
    totalItems: 0
  };

  const updated: FeedHealthEntry = {
    ...base,
    url: normalizeUrl(attempt.url),
    name: attempt.name,
    lastAgentId: attempt.agentId,
    lastRegion: attempt.region,
    lastCheckedAt: attempt.checkedAt,
    lastStatus: attempt.status,
    lastError: attempt.error,
    totalChecks: base.totalChecks + 1,
    totalItems: base.totalItems + Math.max(0, attempt.itemCount)
  };

  if (attempt.status === "ok") {
    updated.lastSuccessAt = attempt.checkedAt;
    updated.consecutiveSuccess = base.consecutiveSuccess + 1;
    updated.consecutiveFailures = 0;
    updated.consecutiveEmpty = 0;
    return updated;
  }

  if (attempt.status === "empty") {
    updated.consecutiveSuccess = 0;
    updated.consecutiveEmpty = base.consecutiveEmpty + 1;
    updated.consecutiveFailures = 0;
    return updated;
  }

  updated.consecutiveSuccess = 0;
  updated.consecutiveEmpty = 0;
  updated.consecutiveFailures = base.consecutiveFailures + 1;
  return updated;
}

export async function recordFeedAttempts(attempts: FeedAttempt[]): Promise<void> {
  if (!attempts.length) return;
  const store = await readStore();
  for (const attempt of attempts) {
    const key = normalizeUrl(attempt.url);
    store.entries[key] = nextEntry(store.entries[key], attempt);
  }
  store.updatedAt = new Date().toISOString();
  await writeStore(store);
}

export async function getFeedHealthSnapshot(limit = 200): Promise<{ updatedAt: string; entries: FeedHealthEntry[] }> {
  const store = await readStore();
  const entries = Object.values(store.entries).sort((a, b) => {
    const aRisk = a.consecutiveFailures * 100 + a.consecutiveEmpty * 10;
    const bRisk = b.consecutiveFailures * 100 + b.consecutiveEmpty * 10;
    if (bRisk !== aRisk) return bRisk - aRisk;
    return new Date(b.lastCheckedAt).getTime() - new Date(a.lastCheckedAt).getTime();
  });
  return {
    updatedAt: store.updatedAt,
    entries: entries.slice(0, limit)
  };
}
