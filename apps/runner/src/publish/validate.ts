import {
  BriefPost,
  BriefReport,
  BriefSource,
  dedupeSources,
  normalizeBriefSources
} from "@proof/shared";

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

function normalizeComparableText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\w\s%./-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupeText(value: string): string {
  return normalizeComparableText(value).replace(/\s+/g, " ");
}

const MAX_REPORT_SUMMARY_BULLETS = 5;
const MAX_REPORT_DELTA_BULLETS = 3;

interface ReportCiteRef {
  sourceIds: string[];
  setSourceIds: (next: string[]) => void;
  section: "summary" | "impact" | "action" | "delta";
  text: string;
}

const FALLBACK_SUMMARY_BULLETS = [
  "No additional material deltas were confirmed this cycle.",
  "Use top-line supplier and market signals to refresh actions in the next planning window.",
  "Maintain supplier and contract-readiness monitoring as coverage context evolves.",
  "Prioritize triggers tied to contract events and service-level performance variance.",
  "Keep decisions conservative until cross-validated signals align across sources."
];

function normalizeCitedSourceIds(sourceIds: string[], allowedSourceIds: Set<string>): string[] {
  const normalized = sourceIds.filter(Boolean).map((value) => value.trim()).filter(Boolean);
  const deduped = Array.from(new Set(normalized));
  return deduped.filter((sourceId) => allowedSourceIds.has(sourceId));
}

function countCitationSources(refs: ReportCiteRef[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const ref of refs) {
    const unique = Array.from(new Set(ref.sourceIds));
    for (const sourceId of unique) {
      counts.set(sourceId, (counts.get(sourceId) ?? 0) + 1);
    }
  }
  return counts;
}

function collectCitedReportReferences(report: BriefReport): ReportCiteRef[] {
  const refs: ReportCiteRef[] = [];
  for (const bullet of report.summaryBullets) {
    refs.push({
      sourceIds: [...bullet.sourceIds],
      setSourceIds: (next) => {
        bullet.sourceIds = next;
      },
      section: "summary",
      text: bullet.text
    });
  }

  for (const group of report.impactGroups) {
    for (const bullet of group.bullets) {
      refs.push({
        sourceIds: [...bullet.sourceIds],
        setSourceIds: (next) => {
          bullet.sourceIds = next;
        },
        section: "impact",
        text: bullet.text
      });
    }
  }

  for (const group of report.actionGroups) {
    for (const action of group.actions) {
      refs.push({
        sourceIds: [...action.sourceIds],
        setSourceIds: (next) => {
          action.sourceIds = next;
        },
        section: "action",
        text: action.action
      });
    }
  }

  return refs;
}

function collectDeltaReferences(delta: string[]): ReportCiteRef[] {
  return delta.map((text) => ({
    sourceIds: [],
    setSourceIds: () => {
      return;
    },
    section: "delta",
    text
  }));
}

function dedupeReportItems<T extends { text: string; sourceIds: string[] }>(
  bullets: T[],
  seen: Set<string>
): T[] {
  const out: T[] = [];
  for (const bullet of bullets) {
    const normalized = dedupeText(bullet.text);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(bullet);
  }
  return out;
}

function enforceCitationSpread(refs: ReportCiteRef[]): void {
  const citedRefs = refs.filter((ref) => ref.sourceIds.length > 0);
  if (citedRefs.length === 0) return;
  const sourceIds = new Set(citedRefs.flatMap((ref) => ref.sourceIds));
  if (sourceIds.size < 2) return;

  const isDominant = (counts: Map<string, number>): [string, number] | undefined =>
    Array.from(counts.entries()).reduce<[string, number] | undefined>(
      (best, current) => (best === undefined || current[1] > best[1] ? current : best),
      undefined
    );

  let counts = countCitationSources(citedRefs);
  const total = Array.from(counts.values()).reduce((sum, value) => sum + value, 0);
  let dominantPair = isDominant(counts);
  if (!dominantPair) return;
  let [dominantSource, dominantCount] = dominantPair;
  const maxAllowed = Math.floor(total / 2);
  if (dominantCount <= maxAllowed) return;

  const sectionPriority: Record<ReportCiteRef["section"], number> = {
    delta: 1,
    impact: 2,
    action: 3,
    summary: 4
  };

  let guard = 0;
  while (dominantCount > maxAllowed && guard < 64) {
    guard += 1;
    let changed = false;
    const orderedRefs = [...citedRefs].sort(
      (a, b) => sectionPriority[a.section] - sectionPriority[b.section] || b.sourceIds.length - a.sourceIds.length
    );

    for (const ref of orderedRefs) {
      if (!ref.sourceIds.includes(dominantSource)) continue;

      const alternatives = Array.from(new Set(ref.sourceIds)).filter((sourceId) => sourceId !== dominantSource);
      if (alternatives.length > 0) {
        ref.setSourceIds(alternatives.slice(0, 1));
      } else {
        ref.setSourceIds([]);
      }

      counts = countCitationSources(citedRefs);
      dominantPair = isDominant(counts);
      if (!dominantPair) return;
      [dominantSource, dominantCount] = dominantPair;
      changed = true;
      if (dominantCount <= Math.floor(total / 2)) break;
    }

    if (!changed) break;
  }
}

function applyStrictReportRules(brief: BriefPost): {
  report?: BriefPost["report"];
  deltaSinceLastRun?: string[];
} {
  if (!brief.report) {
    return {
      report: brief.report,
      deltaSinceLastRun: brief.deltaSinceLastRun ? [...brief.deltaSinceLastRun] : undefined
    };
  }

  const allowedSourceIds = new Set(normalizeBriefSources(brief.sources).map((source) => source.sourceId));
  const seen = new Set<string>();

  const normalizedSummary = dedupeReportItems(
    (brief.report.summaryBullets ?? [])
      .map((bullet) => ({
        ...bullet,
        text: bullet.text.trim(),
        sourceIds: normalizeCitedSourceIds(bullet.sourceIds, allowedSourceIds)
      }))
      .filter((bullet) => bullet.text.trim().length > 0),
    seen
  ).slice(0, MAX_REPORT_SUMMARY_BULLETS);

  const summaryBullets = [...normalizedSummary];
  if (summaryBullets.length < MAX_REPORT_SUMMARY_BULLETS) {
    const fallbackNeeded = Math.max(0, MAX_REPORT_SUMMARY_BULLETS - summaryBullets.length);
    const fallbackBullets = FALLBACK_SUMMARY_BULLETS.slice(0, fallbackNeeded);
    for (const fallbackText of fallbackBullets) {
      if (!seen.has(dedupeText(fallbackText))) {
        summaryBullets.push({ text: fallbackText, sourceIds: [], signal: "confirmed" });
        seen.add(dedupeText(fallbackText));
      }
    }
  }

  const impactGroups = (brief.report.impactGroups ?? []).map((group) => ({
    ...group,
    bullets: dedupeReportItems(
      (group.bullets ?? [])
        .map((bullet) => ({
          ...bullet,
          text: bullet.text.trim(),
          sourceIds: normalizeCitedSourceIds(bullet.sourceIds, allowedSourceIds)
        }))
        .filter((bullet) => bullet.text.trim().length > 0),
      seen
    )
  }));

  const actionGroups = (brief.report.actionGroups ?? []).map((group) => ({
    ...group,
    actions: (group.actions ?? [])
      .filter((action) => action.action.trim().length > 0)
      .map((action) => ({
        ...action,
        sourceIds: normalizeCitedSourceIds(action.sourceIds, allowedSourceIds)
      }))
  }));

  const rawDelta = Array.isArray(brief.deltaSinceLastRun) ? brief.deltaSinceLastRun : [];
  const deltaSinceLastRun = dedupeReportItems(
    rawDelta.map((item) => ({
      text: item.trim(),
      sourceIds: []
    })),
    seen
  )
    .slice(0, MAX_REPORT_DELTA_BULLETS)
    .map((item) => item.text)
    .filter(Boolean);

  const normalizedReport: BriefReport = {
    summaryBullets,
    impactGroups,
    actionGroups
  };

  const refs = [...collectCitedReportReferences(normalizedReport), ...collectDeltaReferences(deltaSinceLastRun)];
  enforceCitationSpread(refs);

  return { report: normalizedReport, deltaSinceLastRun };
}

function shouldApplyStrictReportRules(brief: BriefPost): boolean {
  return brief.version === "v2" || Boolean(brief.report);
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
  
  // Hero image URL should either be cached HTTPS or a local data URI placeholder.
  if (brief.heroImageUrl && !brief.heroImageUrl.startsWith("https://") && !brief.heroImageUrl.startsWith("data:image/")) {
    issues.push("Hero image URL must be HTTPS or data:image/");
  }

  if (brief.version === "v2" && !brief.heroImage?.url) {
    issues.push("BriefV2 records must include heroImage.url");
  }
}

/**
 * Validates the sources array
 */
function validateSourcesArray(sources: BriefSource[], allowedUrls: Set<string>, issues: string[]): void {
  if (sources.length === 0) {
    issues.push("Brief must have at least one source");
  }
  
  for (const source of sources) {
    if (!isUrlAllowed(source.url, allowedUrls)) {
      issues.push(`Source URL not in allowed list: ${source.url}`);
    }
  }
  
  // Check for duplicate sources
  const uniqueSources = new Set(sources.map((s) => s.url.toLowerCase()));
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

  // Ensure user-visible structured references (marketIndicators, marketSnapshot, hero source)
  // are included in the sources list. Older/edge-case generators may omit them, which breaks
  // downstream integrity checks and removes attribution from the UI.
  const extraSourceUrls: string[] = [
    ...(brief.selectedArticles ?? []).map((a) => a.url),
    ...(brief.marketIndicators ?? []).map((i) => i.url),
    ...(brief.marketSnapshot ?? []).map((i) => i.sourceUrl),
    brief.heroImageSourceUrl
  ].filter((url): url is string => typeof url === "string" && url.length > 0);

  const mergedSourceInputs = [...(brief.sources ?? []), ...extraSourceUrls];
  const normalizedSources = dedupeSources(normalizeBriefSources(mergedSourceInputs));
  const strictReport = shouldApplyStrictReportRules(brief)
    ? applyStrictReportRules({ ...brief, sources: normalizedSources })
    : { report: brief.report, deltaSinceLastRun: brief.deltaSinceLastRun ? [...brief.deltaSinceLastRun] : undefined };
  
  // Run all validations
  validateTitleAndSummary(brief, issues);
  validateSelectedArticles(brief, allowedUrls, issues);
  validateMarkdownSources(brief, allowedUrls, safeIndexUrls, issues);
  validateHeroImage(brief, allowedUrls, issues);
  validateSourcesArray(normalizedSources, combinedUrls, issues);

  if (brief.claims && brief.claims.length > 0) {
    const evidenceUrls = new Set<string>();
    for (const claim of brief.claims) {
      if (claim.status !== "supported") continue;
      for (const evidence of claim.evidence ?? []) {
        if (evidence.url) evidenceUrls.add(evidence.url);
      }
    }
    if (evidenceUrls.size > 0) {
      const selectedArticleUrls = new Set<string>((brief.selectedArticles ?? []).map((a) => a.url).filter(Boolean));
      for (const source of normalizedSources) {
        // Index/market sources and selected article URLs are allowed to appear without
        // being referenced by a supported claim (they are contextual attribution, not evidence excerpts).
        const exempt = isUrlAllowed(source.url, safeIndexUrls) || isUrlAllowed(source.url, selectedArticleUrls);
        if (exempt) continue;

        if (!isUrlAllowed(source.url, evidenceUrls)) {
          issues.push(`Source not referenced by supported claims: ${source.url}`);
        }
      }
      const sourceUrls = new Set(normalizedSources.map((source) => source.url));
      for (const url of evidenceUrls) {
        if (!isUrlAllowed(url, sourceUrls)) {
          issues.push(`Evidence source missing from sources list: ${url}`);
        }
      }
    }
  }
  
  // If there are issues, throw with details
  if (issues.length > 0) {
    throw new Error(JSON.stringify(issues));
  }
  
  return {
    ...brief,
    ...strictReport,
    status: "published",
    sources: normalizedSources,
    ...(strictReport.report ? { report: strictReport.report } : {}),
    ...(strictReport.deltaSinceLastRun !== undefined ? { deltaSinceLastRun: strictReport.deltaSinceLastRun } : {})
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
