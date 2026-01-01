"use client";

import { CSSProperties, useState } from "react";
import { getProxiedImageUrl } from "../lib/image-proxy";

interface ProxiedImageProps {
  src: string | undefined | null;
  alt: string;
  className?: string;
  fallbackSrc?: string;
  loading?: "lazy" | "eager";
  style?: CSSProperties;
}

// Re-export for convenience
export { getProxiedImageUrl } from "../lib/image-proxy";

/**
 * Image component that proxies external images and handles loading errors
 * with a fallback to placeholder.
 */
export function ProxiedImage({
  src,
  alt,
  className = "",
  fallbackSrc = "/placeholder.svg",
  loading = "lazy",
  style,
}: ProxiedImageProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const proxiedSrc = hasError ? fallbackSrc : getProxiedImageUrl(src);
  
  return (
    <img
      src={proxiedSrc}
      alt={alt}
      className={`${className} ${isLoading ? "animate-pulse bg-muted" : ""}`}
      loading={loading}
      style={style}
      onError={() => {
        if (!hasError) {
          setHasError(true);
          setIsLoading(false);
        }
      }}
      onLoad={() => setIsLoading(false)}
    />
  );
}
