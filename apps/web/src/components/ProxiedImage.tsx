"use client";

import { CSSProperties, useState } from "react";
import { getProxiedImageUrl } from "../lib/image-proxy";

interface ProxiedImageProps {
  src: string | undefined | null;
  alt: string;
  className?: string;
  fallbackSrc?: string | null;
  loading?: "lazy" | "eager";
  style?: CSSProperties;
}

// Re-export for convenience
export { getProxiedImageUrl } from "../lib/image-proxy";

/**
 * Image component that proxies external images and handles loading errors
 * with a neutral no-image state.
 */
export function ProxiedImage({
  src,
  alt,
  className = "",
  fallbackSrc = null,
  loading = "lazy",
  style,
}: ProxiedImageProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const proxiedSrc = hasError ? getProxiedImageUrl(fallbackSrc) : getProxiedImageUrl(src);
  const showNoImageState = !proxiedSrc;

  if (showNoImageState) {
    return (
      <div
        aria-label="No image available"
        className={`${className} flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 text-slate-200`}
        style={style}
      >
        <span className="text-xs font-medium uppercase tracking-[0.14em]">No image</span>
      </div>
    );
  }
  
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
