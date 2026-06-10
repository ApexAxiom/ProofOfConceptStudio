/**
 * Brand mark: faceted gold diamond on a dark tile. Single source of truth for
 * the logo used in the top bar, mobile drawer, and footer.
 */
export function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <span
      className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-primary/25 bg-gradient-to-br from-primary/20 via-primary/5 to-transparent"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none">
        <path d="M12 2L22 12L12 22L2 12L12 2Z" fill="hsl(43, 74%, 49%)" fillOpacity="0.9" />
        <path d="M12 2L22 12H2L12 2Z" fill="hsl(43, 90%, 62%)" fillOpacity="0.85" />
        <path d="M12 6.5L17.5 12L12 17.5L6.5 12L12 6.5Z" fill="hsl(225, 25%, 8%)" fillOpacity="0.35" />
      </svg>
    </span>
  );
}
