const RETRY_BACKOFF_MS = [300, 900, 1800];

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetches a URL with retries. Returns null on persistent failure — adapters
 * must degrade to "no data" rather than fabricate values.
 */
export async function fetchTextWithRetry(url: string, label: string): Promise<string | null> {
  for (let attempt = 0; attempt < RETRY_BACKOFF_MS.length; attempt += 1) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; ProofStudio/1.0)" },
        cache: "no-store"
      });
      if (!res.ok) {
        if (attempt < RETRY_BACKOFF_MS.length - 1) {
          await sleep(RETRY_BACKOFF_MS[attempt]);
          continue;
        }
        console.warn(`[marketHistory] ${label}: HTTP ${res.status}`);
        return null;
      }
      return await res.text();
    } catch (error) {
      if (attempt < RETRY_BACKOFF_MS.length - 1) {
        await sleep(RETRY_BACKOFF_MS[attempt]);
        continue;
      }
      console.warn(`[marketHistory] ${label}: fetch failed`, error);
    }
  }
  return null;
}

export function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string") {
    const cleaned = value.replace(/[,$\s]/g, "");
    if (!cleaned || cleaned === ".") return undefined;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

const MONTHS: Record<string, string> = {
  january: "01", february: "02", march: "03", april: "04", may: "05", june: "06",
  july: "07", august: "08", september: "09", october: "10", november: "11", december: "12",
  jan: "01", feb: "02", mar: "03", apr: "04", jun: "06", jul: "07", aug: "08",
  sep: "09", oct: "10", nov: "11", dec: "12"
};

/**
 * Normalizes provider date formats to YYYY-MM-DD:
 * - "2026-06-08" (daily), "2026-06" (monthly), "2026" → first day of period
 * - "8 June 2026" / "08 Jun 2026" (Baker Hughes table)
 * - "8/06/2026" (AU day-first CSV)
 */
export function normalizeDay(raw: string): string | undefined {
  const value = (raw ?? "").trim();
  if (!value) return undefined;

  const iso = value.match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/);
  if (iso) {
    return `${iso[1]}-${iso[2] ?? "01"}-${iso[3] ?? "01"}`;
  }

  const dayMonthName = value.match(/^(\d{1,2})\s+([A-Za-z]+)\.?,?\s+(\d{4})$/);
  if (dayMonthName) {
    const month = MONTHS[dayMonthName[2].toLowerCase()];
    if (month) return `${dayMonthName[3]}-${month}-${dayMonthName[1].padStart(2, "0")}`;
  }

  const monthNameYear = value.match(/^([A-Za-z]+)[\s-]+(\d{4})$/);
  if (monthNameYear) {
    const month = MONTHS[monthNameYear[1].toLowerCase()];
    if (month) return `${monthNameYear[2]}-${month}-01`;
  }

  const dayFirst = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dayFirst) {
    return `${dayFirst[3]}-${dayFirst[2].padStart(2, "0")}-${dayFirst[1].padStart(2, "0")}`;
  }

  return undefined;
}

export function isValidDay(day: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  return !Number.isNaN(Date.parse(`${day}T00:00:00.000Z`));
}

export function addDaysToDay(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function daysBetween(earlierDay: string, laterDay: string): number {
  const earlier = Date.parse(`${earlierDay}T00:00:00.000Z`);
  const later = Date.parse(`${laterDay}T00:00:00.000Z`);
  if (Number.isNaN(earlier) || Number.isNaN(later)) return 0;
  return Math.round((later - earlier) / (24 * 60 * 60 * 1000));
}
