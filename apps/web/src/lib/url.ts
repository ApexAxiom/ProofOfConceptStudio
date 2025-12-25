/**
 * Extract the first valid http/https URL from a raw string.
 * Returns null when no valid URL can be found.
 */
export function extractValidUrl(raw?: string | null): string | null {
  if (!raw) return null;

  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    const directUrl = new URL(trimmed);
    if (["http:", "https:"].includes(directUrl.protocol)) {
      return directUrl.toString();
    }
  } catch {
    // Fall through to regex extraction when direct parsing fails.
  }

  const match = trimmed.match(/https?:\/\/[^\s)<>"']+/i);
  if (match) {
    try {
      const matchedUrl = new URL(match[0]);
      if (["http:", "https:"].includes(matchedUrl.protocol)) {
        return matchedUrl.toString();
      }
    } catch {
      // Ignore invalid matches and fall through to null.
    }
  }

  return null;
}
