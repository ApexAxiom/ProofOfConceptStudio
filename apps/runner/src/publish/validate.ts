import { BriefPost } from "@proof/shared";

/**
 * Validation rules for brief sections
 */
const VALIDATION_RULES = {
  minSelectedArticles: 1,
  maxSelectedArticles: 5,
  preferredArticleCount: 3,
  minTitleLength: 10,
  maxTitleLength: 150,
  minSummaryLength: 20,
  minBodyLength: 200
};

/**
 * Validates that a URL is in the allowed set
 */
function isUrlAllowed(url: string, allowedUrls: Set<string>): boolean {
  if (!url) return false;
  // Normalize URL for comparison (remove trailing slashes, etc.)
  const normalized = url.replace(/\/$/, "").toLowerCase();
  for (const allowed of allowedUrls) {
    const normalizedAllowed = allowed.replace(/\/$/, "").toLowerCase();
    if (normalized === normalizedAllowed) return true;
  }
  return allowedUrls.has(url);
}

/**
 * Extracts all URLs from markdown content
 */
function extractMarkdownUrls(markdown: string): Set<string> {
  const urls = new Set<string>();
  // Match markdown links: [text](url)
  const linkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;
  let match;
  while ((match = linkRegex.exec(markdown)) !== null) {
    urls.add(match[2]);
  }
  // Match raw URLs
  const urlRegex = /https?:\/\/[^\s<>)"']+/g;
  while ((match = urlRegex.exec(markdown)) !== null) {
    urls.add(match[0].replace(/[.,;:!?]+$/, "")); // Remove trailing punctuation
  }
  return urls;
}

/**
 * Validates that selected articles have proper links
 */
function validateSelectedArticles(
  brief: BriefPost,
  allowedUrls: Set<string>,
  issues: string[]
): void {
  const selectedArticles = brief.selectedArticles || [];
  
  // Check article count
  if (selectedArticles.length < VALIDATION_RULES.minSelectedArticles) {
    issues.push(`Brief must have at least ${VALIDATION_RULES.minSelectedArticles} selected articles`);
  }
  
  if (selectedArticles.length > VALIDATION_RULES.maxSelectedArticles) {
    issues.push(`Brief must have at most ${VALIDATION_RULES.maxSelectedArticles} selected articles`);
  }
  
  // Validate each selected article
  for (let i = 0; i < selectedArticles.length; i++) {
    const article = selectedArticles[i];
    
    // Check URL exists
    if (!article.url) {
      issues.push(`Selected article ${i + 1} is missing URL`);
      continue;
    }
    
    // Check URL is allowed
    if (!isUrlAllowed(article.url, allowedUrls)) {
      issues.push(`Selected article ${i + 1} URL not in allowed list: ${article.url}`);
    }
    
    // Check title exists
    if (!article.title || article.title.trim().length === 0) {
      issues.push(`Selected article ${i + 1} is missing title`);
    }
    
    // Check brief content exists
    if (!article.briefContent || article.briefContent.trim().length < 20) {
      issues.push(`Selected article ${i + 1} has insufficient brief content`);
    }
  }
}

/**
 * Validates that the markdown body contains proper source links
 */
function validateMarkdownSources(
  brief: BriefPost,
  allowedUrls: Set<string>,
  indexUrls: Set<string>,
  issues: string[]
): void {
  const body = brief.bodyMarkdown || "";
  
  if (!body || body.length < VALIDATION_RULES.minBodyLength) {
    issues.push(`Body markdown is too short (min ${VALIDATION_RULES.minBodyLength} chars)`);
    return;
  }
  
  // Extract all URLs from the markdown
  const usedUrls = extractMarkdownUrls(body);
  const combinedAllowed = new Set([...allowedUrls, ...indexUrls]);
  
  // Check that all used URLs are allowed
  for (const url of usedUrls) {
    if (!isUrlAllowed(url, combinedAllowed)) {
      issues.push(`URL not in allowed list: ${url}`);
    }
  }
  
  // Check that article source links appear in the body
  const selectedArticles = brief.selectedArticles || [];
  for (const article of selectedArticles) {
    if (article.url && !usedUrls.has(article.url)) {
      // Check with normalized comparison
      const found = Array.from(usedUrls).some(
        (u) => u.replace(/\/$/, "").toLowerCase() === article.url.replace(/\/$/, "").toLowerCase()
      );
      if (!found) {
        issues.push(`Selected article URL not found in body: ${article.url}`);
      }
    }
  }
}

/**
 * Validates title and summary
 */
function validateTitleAndSummary(brief: BriefPost, issues: string[]): void {
  // Validate title
  if (!brief.title || brief.title.trim().length < VALIDATION_RULES.minTitleLength) {
    issues.push(`Title is too short (min ${VALIDATION_RULES.minTitleLength} chars)`);
  }
  
  if (brief.title && brief.title.length > VALIDATION_RULES.maxTitleLength) {
    issues.push(`Title is too long (max ${VALIDATION_RULES.maxTitleLength} chars)`);
  }
  
  // Validate summary
  if (!brief.summary || brief.summary.trim().length < VALIDATION_RULES.minSummaryLength) {
    issues.push(`Summary is too short (min ${VALIDATION_RULES.minSummaryLength} chars)`);
  }
}

/**
 * Validates hero image setup
 */
function validateHeroImage(brief: BriefPost, allowedUrls: Set<string>, issues: string[]): void {
  // Hero image source URL should be from an allowed article
  if (brief.heroImageSourceUrl && !isUrlAllowed(brief.heroImageSourceUrl, allowedUrls)) {
    issues.push(`Hero image source URL not in allowed list: ${brief.heroImageSourceUrl}`);
  }
  
  // If we have a hero image URL, it should be HTTPS
  if (brief.heroImageUrl && !brief.heroImageUrl.startsWith("https://")) {
    issues.push("Hero image URL must be HTTPS");
  }
}

/**
 * Validates the sources array
 */
function validateSourcesArray(brief: BriefPost, allowedUrls: Set<string>, issues: string[]): void {
  const sources = brief.sources || [];
  
  if (sources.length === 0) {
    issues.push("Brief must have at least one source");
  }
  
  for (const source of sources) {
    if (!isUrlAllowed(source, allowedUrls)) {
      issues.push(`Source URL not in allowed list: ${source}`);
    }
  }
  
  // Check for duplicate sources
  const uniqueSources = new Set(sources.map((s) => s.toLowerCase()));
  if (uniqueSources.size !== sources.length) {
    issues.push("Duplicate sources detected");
  }
}

/**
 * Validates a brief against required structure and URL rules.
 * Returns the validated brief with status updated to "published" if valid.
 * Throws an error with JSON-encoded issues if validation fails.
 */
export function validateBrief(
  brief: BriefPost,
  allowedUrls: Set<string>,
  indexUrls?: Set<string>
): BriefPost {
  const issues: string[] = [];
  const safeIndexUrls = indexUrls || new Set<string>();
  const combinedUrls = new Set([...allowedUrls, ...safeIndexUrls]);
  
  // Run all validations
  validateTitleAndSummary(brief, issues);
  validateSelectedArticles(brief, allowedUrls, issues);
  validateMarkdownSources(brief, allowedUrls, safeIndexUrls, issues);
  validateHeroImage(brief, allowedUrls, issues);
  validateSourcesArray(brief, combinedUrls, issues);
  
  // If there are issues, throw with details
  if (issues.length > 0) {
    throw new Error(JSON.stringify(issues));
  }
  
  // Collect all referenced URLs for the sources array
  const allSources = new Set<string>();
  
  // Add selected article URLs
  for (const article of brief.selectedArticles || []) {
    if (article.url) allSources.add(article.url);
  }
  
  // Add any additional sources from markdown
  const markdownUrls = extractMarkdownUrls(brief.bodyMarkdown || "");
  for (const url of markdownUrls) {
    if (allowedUrls.has(url)) {
      allSources.add(url);
    }
  }
  
  return {
    ...brief,
    status: "published",
    sources: Array.from(allSources)
  };
}

/**
 * Performs a quick sanity check on a brief without full validation.
 * Used for pre-flight checks before expensive operations.
 */
export function quickValidate(brief: Partial<BriefPost>): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  
  if (!brief.title || brief.title.length < 5) {
    issues.push("Title too short or missing");
  }
  
  if (!brief.bodyMarkdown || brief.bodyMarkdown.length < 100) {
    issues.push("Body too short or missing");
  }
  
  if (!brief.selectedArticles || brief.selectedArticles.length === 0) {
    issues.push("No selected articles");
  }
  
  return {
    ok: issues.length === 0,
    issues
  };
}
