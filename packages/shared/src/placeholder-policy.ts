import type { BriefPost, BriefSourceInput } from "./types.js";

type PlaceholderArticle = {
  title?: string;
  summary?: string;
  source?: string;
  url?: string;
};

type PlaceholderPolicyOptions = {
  env?: NodeJS.ProcessEnv;
};

const EXPLICIT_ALLOW_KEYS = ["PLACEHOLDER_CONTENT_ENABLED", "ALLOW_PLACEHOLDER_CONTENT"] as const;

const BRIEF_PATTERNS: RegExp[] = [
  /baseline coverage/i,
  /coverage fallback/i,
  /system will retry/i,
  /no material change detected/i,
  /using(?: the)? (?:most recent|latest) brief/i,
  /automated refresh was unavailable/i,
  /brief generation failed/i,
  /feed refresh in progress/i
];

const ARTICLE_PATTERNS: RegExp[] = [
  /feed refresh in progress/i,
  /no stories available/i,
  /no headlines available/i,
  /sample data/i,
  /synthetic/i,
  /placeholder/i,
  /baseline coverage/i,
  /system will retry/i
];

const PLACEHOLDER_TAGS = new Set([
  "system-placeholder",
  "baseline",
  "carry-forward",
  "previous",
  "no-updates",
  "generation-failed"
]);

function parseBoolean(value: string | undefined): boolean | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") return true;
  if (normalized === "false" || normalized === "0" || normalized === "no") return false;
  return undefined;
}

function hasPattern(value: string | undefined, patterns: RegExp[]): boolean {
  if (!value) return false;
  return patterns.some((pattern) => pattern.test(value));
}

function sourceLooksSynthetic(source: BriefSourceInput): boolean {
  if (typeof source === "string") {
    return source.includes("example.com");
  }
  const title = source.title ?? "";
  const url = source.url ?? "";
  return title.toLowerCase() === "system" || url.includes("example.com");
}

export function isPlaceholdersAllowed(options?: PlaceholderPolicyOptions): boolean {
  const env = options?.env ?? process.env;
  for (const key of EXPLICIT_ALLOW_KEYS) {
    const parsed = parseBoolean(env[key]);
    if (parsed !== undefined) return parsed;
  }
  return env.NODE_ENV !== "production";
}

export function isUserVisiblePlaceholderBrief(brief: Partial<BriefPost> | null | undefined): boolean {
  if (!brief) return false;

  if (brief.generationStatus && brief.generationStatus !== "published") {
    return true;
  }

  const tags = (brief.tags ?? []).map((tag) => tag.toLowerCase());
  if (tags.some((tag) => PLACEHOLDER_TAGS.has(tag))) {
    return true;
  }

  if (hasPattern(brief.title, BRIEF_PATTERNS) || hasPattern(brief.summary, BRIEF_PATTERNS) || hasPattern(brief.bodyMarkdown, BRIEF_PATTERNS)) {
    return true;
  }

  if ((brief.sources ?? []).some((source) => sourceLooksSynthetic(source))) {
    return true;
  }

  return false;
}

export function isUserVisiblePlaceholderArticle(article: PlaceholderArticle | null | undefined): boolean {
  if (!article) return false;
  if (hasPattern(article.title, ARTICLE_PATTERNS) || hasPattern(article.summary, ARTICLE_PATTERNS)) {
    return true;
  }

  const source = article.source?.trim().toLowerCase();
  if (source === "system") return true;
  if (article.url && /news\.google\.com\/search/i.test(article.url) && hasPattern(article.title, ARTICLE_PATTERNS)) {
    return true;
  }

  return false;
}
