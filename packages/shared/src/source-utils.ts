import type { BriefSource, BriefSourceInput } from "./types.js";

function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = (hash >>> 0) * 0x01000193;
  }
  return (hash >>> 0).toString(36);
}

export function buildSourceId(url: string): string {
  const normalized = url.trim().toLowerCase();
  return `src_${fnv1a(normalized)}`;
}

export function normalizeBriefSources(sources?: BriefSourceInput[]): BriefSource[] {
  if (!Array.isArray(sources)) return [];
  return sources
    .map((source) => {
      if (!source) return null;
      if (typeof source === "string") {
        const url = source.trim();
        if (!url) return null;
        return { sourceId: buildSourceId(url), url };
      }
      if (!source.url) return null;
      return {
        sourceId: source.sourceId || buildSourceId(source.url),
        url: source.url,
        title: source.title,
        publishedAt: source.publishedAt,
        retrievedAt: source.retrievedAt
      } satisfies BriefSource;
    })
    .filter((item): item is BriefSource => Boolean(item));
}

export function dedupeSources(sources: BriefSource[]): BriefSource[] {
  const seen = new Set<string>();
  const deduped: BriefSource[] = [];
  for (const source of sources) {
    const key = source.sourceId || source.url;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(source);
  }
  return deduped;
}

export function sourceUrlsFromSources(sources: BriefSource[]): string[] {
  return dedupeSources(sources)
    .map((source) => source.url)
    .filter(Boolean);
}
