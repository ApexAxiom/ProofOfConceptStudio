/**
 * Returns a proxied URL for external images to bypass hotlinking restrictions.
 * Local images (starting with /) are returned as-is.
 */
export function getProxiedImageUrl(url: string | undefined | null): string | null {
  if (!url || url.trim() === "") {
    return null;
  }
  
  const trimmedUrl = url.trim();
  const lower = trimmedUrl.toLowerCase();

  // Suppress known synthetic hero placeholders.
  if (
    lower.startsWith("data:image/") &&
    (lower.includes("daily%20intel%20report") || lower.includes("daily intel report") || lower.includes("baseline%20coverage"))
  ) {
    return null;
  }
  
  // Local images don't need proxying
  if (trimmedUrl.startsWith("/")) {
    return trimmedUrl;
  }

  // Inline SVG/data placeholders can be rendered directly.
  if (trimmedUrl.startsWith("data:image/")) {
    return trimmedUrl;
  }
  
  // Only proxy http/https URLs
  if (trimmedUrl.startsWith("http://") || trimmedUrl.startsWith("https://")) {
    return `/api/image-proxy?url=${encodeURIComponent(trimmedUrl)}`;
  }
  
  return null;
}
