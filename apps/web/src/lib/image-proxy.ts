/**
 * Returns a proxied URL for external images to bypass hotlinking restrictions.
 * Local images (starting with /) are returned as-is.
 */
export function getProxiedImageUrl(url: string | undefined | null): string {
  if (!url || url.trim() === "") {
    return "/placeholder.svg";
  }
  
  const trimmedUrl = url.trim();
  
  // Local images don't need proxying
  if (trimmedUrl.startsWith("/")) {
    return trimmedUrl;
  }
  
  // Only proxy http/https URLs
  if (trimmedUrl.startsWith("http://") || trimmedUrl.startsWith("https://")) {
    return `/api/image-proxy?url=${encodeURIComponent(trimmedUrl)}`;
  }
  
  // Fallback for any other format
  return "/placeholder.svg";
}
