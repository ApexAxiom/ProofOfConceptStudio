import { portfolioLabel } from "./portfolios.js";
import { REGIONS, RegionSlug } from "./regions.js";

export type BriefV2NewsStatus = "ok" | "thin-category" | "fallback-context";

export interface BriefV2TopStory {
  sourceArticleIndex: number;
  title: string;
  url: string;
  sourceName?: string;
  publishedAt?: string;
  briefContent?: string;
  categoryImportance?: string;
  keyMetrics?: string[];
}

export interface BriefV2HeroImage {
  url: string;
  alt: string;
  sourceArticleIndex: number;
  cacheKey?: string;
}

export interface BriefV2 {
  version: "v2";
  newsStatus: BriefV2NewsStatus;
  contextNote?: string;
  topStories: BriefV2TopStory[];
  heroImage: BriefV2HeroImage;
}

export interface BriefViewModelV2 {
  postId: string;
  portfolio: string;
  region: RegionSlug;
  title: string;
  publishedAt: string;
  dateLabel: string;
  newsStatus: BriefV2NewsStatus;
  deltaBullets: string[];
  topStories: BriefV2TopStory[];
  heroImage: BriefV2HeroImage;
  contextNote?: string;
}

const FALLBACK_CONTEXT_PREFIX =
  "No material category-specific items detected today; relevant oil & gas context that could affect this category is:";

const NEWS_STATUS_SET = new Set<BriefV2NewsStatus>(["ok", "thin-category", "fallback-context"]);

type RawRecord = Record<string, unknown>;

function isRecord(value: unknown): value is RawRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function asStringArray(value: unknown, maxItems = 3): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    const normalized = asString(item);
    if (!normalized) continue;
    if (out.includes(normalized)) continue;
    out.push(normalized);
    if (out.length >= maxItems) break;
  }
  return out;
}

function asInt(value: unknown): number | undefined {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 1) return undefined;
  return numeric;
}

function isRegionSlug(value: unknown): value is RegionSlug {
  return value === "au" || value === "us-mx-la-lng";
}

function normalizeRegion(value: unknown, fallback?: RegionSlug): RegionSlug {
  if (isRegionSlug(value)) return value;
  if (fallback && isRegionSlug(fallback)) return fallback;
  return "us-mx-la-lng";
}

function normalizeIsoDate(value: unknown): string {
  const raw = asString(value);
  if (!raw) return new Date().toISOString();
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
  return parsed.toISOString();
}

function simpleHash(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function toDateLabel(publishedAt: string, region: RegionSlug): string {
  const timeZone = REGIONS[region]?.timeZone ?? REGIONS["us-mx-la-lng"].timeZone;
  const tzLabel = region === "au" ? "AWST" : "CST";
  return (
    new Date(publishedAt).toLocaleString("en-US", {
      timeZone,
      dateStyle: "medium",
      timeStyle: "short",
      hour12: true
    }) + ` ${tzLabel}`
  );
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function makeCategoryPlaceholderDataUrl(categoryLabel: string): string {
  const fallbackCategory = categoryLabel.trim() || "Category";
  const safeCategory = fallbackCategory.slice(0, 52).toUpperCase();
  const title = `${safeCategory} - Daily Intel Report`;
  const subtitle = "Brief image unavailable; cached placeholder rendered.";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="${escapeXml(
    title
  )}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0b1220"/>
      <stop offset="100%" stop-color="#1f2937"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect x="52" y="52" width="1096" height="526" rx="24" fill="none" stroke="#334155" stroke-width="2"/>
  <text x="600" y="305" text-anchor="middle" fill="#f8fafc" font-size="48" font-family="Segoe UI, Arial, sans-serif" font-weight="700">${escapeXml(
    title
  )}</text>
  <text x="600" y="360" text-anchor="middle" fill="#94a3b8" font-size="24" font-family="Segoe UI, Arial, sans-serif">${escapeXml(
    subtitle
  )}</text>
</svg>`;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function toStory(value: unknown, fallbackIndex: number): BriefV2TopStory | undefined {
  if (!isRecord(value)) return undefined;
  const title = asString(value.title);
  const url = asString(value.url);
  if (!title || !url) return undefined;
  const sourceArticleIndex = asInt(value.sourceArticleIndex) ?? asInt(value.sourceIndex) ?? fallbackIndex;
  return {
    sourceArticleIndex,
    title,
    url,
    sourceName: asString(value.sourceName),
    publishedAt: asString(value.publishedAt),
    briefContent: asString(value.briefContent),
    categoryImportance: asString(value.categoryImportance),
    keyMetrics: asStringArray(value.keyMetrics, 6)
  };
}

function readTopStories(record: RawRecord): BriefV2TopStory[] {
  const fromTopStories = Array.isArray(record.topStories)
    ? record.topStories
        .map((item, idx) => toStory(item, idx + 1))
        .filter((item): item is BriefV2TopStory => Boolean(item))
    : [];

  if (fromTopStories.length > 0) return fromTopStories.slice(0, 3);

  const selected = Array.isArray(record.selectedArticles)
    ? record.selectedArticles
        .map((item, idx) => toStory(item, idx + 1))
        .filter((item): item is BriefV2TopStory => Boolean(item))
    : [];

  return selected.slice(0, 3);
}

function isGenericTitle(title: string): boolean {
  const normalized = title.toLowerCase();
  return normalized.includes("daily brief") || normalized === "brief" || normalized.length < 8;
}

function buildTitle(record: RawRecord, topStories: BriefV2TopStory[]): string {
  const existing = asString(record.title);
  if (existing && !isGenericTitle(existing)) return existing;

  if (topStories[0]?.title) {
    const portfolio = asString(record.portfolio);
    const categoryLabel = portfolio ? portfolioLabel(portfolio) : "Category";
    return `${topStories[0].title} | ${categoryLabel} sourcing implications`;
  }

  const portfolio = asString(record.portfolio);
  const categoryLabel = portfolio ? portfolioLabel(portfolio) : "Category";
  return `${categoryLabel} sourcing intelligence update`;
}

function readNewsStatus(record: RawRecord, topStories: BriefV2TopStory[]): BriefV2NewsStatus {
  const raw = asString(record.newsStatus);
  if (raw && NEWS_STATUS_SET.has(raw as BriefV2NewsStatus)) {
    return raw as BriefV2NewsStatus;
  }
  if (topStories.length < 2) return "thin-category";
  return "ok";
}

function readContextNote(record: RawRecord, newsStatus: BriefV2NewsStatus, topStories: BriefV2TopStory[]): string | undefined {
  const existing = asString(record.contextNote);
  if (existing) return existing;
  if (newsStatus === "ok") return undefined;

  const context = topStories
    .map((story) => {
      const source = story.sourceName ? ` (${story.sourceName})` : "";
      return `${story.title}${source}`;
    })
    .join("; ");

  const suffix = context
    ? `${context}. Procurement implication: focus on supplier resilience, contractual flexibility, and price guardrails until category-specific flow strengthens.`
    : "general upstream and supply-chain coverage from monitored sources. Procurement implication: maintain optionality and tighter supplier-risk checks until category-specific flow strengthens.";

  return `${FALLBACK_CONTEXT_PREFIX} ${suffix}`;
}

function readHeroImage(record: RawRecord, topStories: BriefV2TopStory[], title: string): BriefV2HeroImage {
  const rawHero = isRecord(record.heroImage) ? record.heroImage : undefined;
  const rawHeroUrl = rawHero ? asString(rawHero.url) : undefined;
  const rawHeroAlt = rawHero ? asString(rawHero.alt) : undefined;
  const rawHeroSourceIndex = rawHero ? asInt(rawHero.sourceArticleIndex) : undefined;
  const rawCacheKey = rawHero ? asString(rawHero.cacheKey) : undefined;

  const validRawHeroUrl =
    rawHeroUrl && (rawHeroUrl.startsWith("https://") || rawHeroUrl.startsWith("data:image/")) ? rawHeroUrl : undefined;

  const sourceArticleIndex = rawHeroSourceIndex ?? topStories[0]?.sourceArticleIndex ?? 1;
  const categoryName = asString(record.portfolio) ? portfolioLabel(asString(record.portfolio) as string) : "Category";

  if (!validRawHeroUrl) {
    return {
      url: makeCategoryPlaceholderDataUrl(categoryName),
      alt: `${categoryName} - Daily Intel Report`,
      sourceArticleIndex
    };
  }

  return {
    url: validRawHeroUrl,
    alt: rawHeroAlt ?? asString(record.heroImageAlt) ?? topStories[0]?.title ?? title,
    sourceArticleIndex,
    cacheKey: rawCacheKey
  };
}

export function validateBriefV2Record(
  rawBriefRecord: unknown,
  opts?: { hasPreviousBrief?: boolean }
): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  if (!isRecord(rawBriefRecord)) {
    return { ok: false, issues: ["brief record must be an object"] };
  }

  const version = asString(rawBriefRecord.version);
  if (version !== "v2") {
    return { ok: true, issues: [] };
  }

  const status = asString(rawBriefRecord.newsStatus);
  if (!status || !NEWS_STATUS_SET.has(status as BriefV2NewsStatus)) {
    issues.push("v2 brief must include valid newsStatus");
  }

  const hero = isRecord(rawBriefRecord.heroImage) ? rawBriefRecord.heroImage : undefined;
  const heroUrl = hero ? asString(hero.url) : undefined;
  const heroAlt = hero ? asString(hero.alt) : undefined;
  if (!heroUrl) {
    issues.push("v2 brief must include heroImage.url");
  } else if (!heroUrl.startsWith("https://") && !heroUrl.startsWith("data:image/")) {
    issues.push("v2 heroImage.url must be https:// or data:image/");
  }
  if (!heroAlt) {
    issues.push("v2 brief must include heroImage.alt");
  }

  const topStories = Array.isArray(rawBriefRecord.topStories) ? rawBriefRecord.topStories : [];
  if (topStories.length === 0) {
    issues.push("v2 brief must include at least one topStories item");
  }

  if (opts?.hasPreviousBrief) {
    const delta = asStringArray(rawBriefRecord.deltaSinceLastRun, 3);
    if (delta.length === 0) {
      issues.push("v2 brief must include deltaSinceLastRun when previous brief exists");
    }
  }

  return { ok: issues.length === 0, issues };
}

export function toBriefViewModelV2(
  rawBriefRecord: unknown,
  opts?: { defaultRegion?: RegionSlug }
): BriefViewModelV2 {
  const record = isRecord(rawBriefRecord) ? rawBriefRecord : {};
  const region = normalizeRegion(record.region, opts?.defaultRegion);
  const publishedAt = normalizeIsoDate(record.publishedAt);
  const topStories = readTopStories(record);
  const title = buildTitle(record, topStories);
  const newsStatus = readNewsStatus(record, topStories);
  const contextNote = readContextNote(record, newsStatus, topStories);
  const heroImage = readHeroImage(record, topStories, title);

  return {
    postId: asString(record.postId) ?? `legacy-${simpleHash(`${publishedAt}-${title}`)}`,
    portfolio: asString(record.portfolio) ?? "unknown-portfolio",
    region,
    title,
    publishedAt,
    dateLabel: toDateLabel(publishedAt, region),
    newsStatus,
    deltaBullets: asStringArray(record.deltaSinceLastRun, 3),
    topStories,
    heroImage,
    contextNote
  };
}
