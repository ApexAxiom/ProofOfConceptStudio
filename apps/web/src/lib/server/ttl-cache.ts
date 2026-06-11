/**
 * Process-local TTL memo used as a fallback when Next's incremental cache is
 * unavailable (`unstable_cache` throws "incrementalCache missing" in some
 * runtimes). Without it, every request on those paths re-runs the full
 * DynamoDB/RSS work, which is what made navigation feel sluggish.
 *
 * Entries share the promise while a build is in flight so concurrent requests
 * never duplicate work, and a stale value is served if a refresh fails.
 */
interface TtlEntry {
  value: Promise<unknown>;
  expiresAt: number;
}

const store = new Map<string, TtlEntry>();
const MAX_ENTRIES = 500;

export async function withTtlMemo<T>(key: string, ttlMs: number, build: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expiresAt > now) {
    return hit.value as Promise<T>;
  }

  const value = build();
  store.set(key, { value, expiresAt: now + ttlMs });
  if (store.size > MAX_ENTRIES) {
    for (const [entryKey, entry] of store) {
      if (entry.expiresAt <= now) store.delete(entryKey);
    }
    while (store.size > MAX_ENTRIES) {
      const oldest = store.keys().next().value;
      if (oldest === undefined) break;
      store.delete(oldest);
    }
  }

  try {
    return await value;
  } catch (error) {
    // Don't cache failures; keep the previous entry if it still exists.
    if (store.get(key)?.value === value) {
      if (hit) {
        store.set(key, hit);
      } else {
        store.delete(key);
      }
    }
    throw error;
  }
}
