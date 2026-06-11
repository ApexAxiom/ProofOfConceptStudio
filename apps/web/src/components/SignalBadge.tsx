import type { BriefSignalLevel } from "@proof/shared";

const STYLES: Record<BriefSignalLevel, { label: string; className: string }> = {
  act: {
    label: "Act",
    className: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400"
  },
  watch: {
    label: "Watch",
    className: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
  },
  awareness: {
    label: "Awareness",
    className: "border-sky-500/30 bg-sky-500/10 text-sky-400"
  }
};

/**
 * Triage chip for a brief's signal level. Renders nothing for briefs
 * published before signal levels existed.
 */
export function SignalBadge({ level, className }: { level?: BriefSignalLevel; className?: string }) {
  if (!level || !STYLES[level]) return null;
  const style = STYLES[level];
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${style.className} ${className ?? ""}`}
    >
      {style.label}
    </span>
  );
}
