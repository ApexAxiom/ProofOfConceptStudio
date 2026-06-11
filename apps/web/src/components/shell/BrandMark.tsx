/**
 * Brand mark: minimal diamond monogram on a neutral tile. Single source of
 * truth for the logo used in the top bar, mobile drawer, and footer.
 */
export function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <span
      className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-foreground"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none">
        <path
          d="M12 3L21 12L12 21L3 12L12 3Z"
          stroke="hsl(var(--background))"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="12" r="2.2" fill="hsl(var(--primary))" />
      </svg>
    </span>
  );
}
