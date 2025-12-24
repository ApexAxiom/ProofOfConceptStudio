import { BriefPost } from "@proof/shared";

const SECTION_RULES = [
  { heading: "## Quick Takes", min: 3, max: 4 },
  { heading: "## Supporting Links", min: 2, max: 4 },
  { heading: "## Market Snapshot", min: 2, max: undefined, indexOnly: true }
];

function parseSections(body: string): Map<string, string[]> {
  const sections = new Map<string, string[]>();
  const lines = body.split(/\r?\n/);
  let currentHeading: string | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (/^##\s+.+/.test(line.trim())) {
      currentHeading = line.trim();
      if (!sections.has(currentHeading)) {
        sections.set(currentHeading, []);
      }
      continue;
    }

    if (currentHeading) {
      sections.get(currentHeading)?.push(rawLine);
    }
  }

  return sections;
}

function bulletLines(lines: string[]): string[] {
  return lines
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "));
}

function urlAtEnd(bullet: string): string | null {
  const match = bullet.match(/\((https?:\/\/[^\s)]+)\)\s*$/);
  return match?.[1] ?? null;
}

function extractOverviewLine(body: string): string | null {
  const lines = body.split(/\r?\n/);
  return lines.find((line) => line.trim().toLowerCase().startsWith("**overview:**")) ?? null;
}

function parseSources(lines: string[]): string[] {
  return lines
    .map((line) => line.trim())
    .map((line) => line.replace(/^-\s*/, "").trim())
    .filter(Boolean);
}

/**
 * Validates a brief markdown body against required sections and URL rules.
 */
export function validateBrief(brief: BriefPost, allowedUrls: Set<string>, indexUrls?: Set<string>): BriefPost {
  const issues: string[] = [];
  const body = brief.bodyMarkdown || "";
  if (!body) issues.push("Body markdown is empty");

  const sections = parseSections(body);
  const referencedUrls = new Set<string>();

  const overviewLine = extractOverviewLine(body);
  if (!overviewLine) {
    issues.push("Missing overview section");
  } else {
    const overviewUrl = urlAtEnd(overviewLine.replace(/^\*\*Overview:\*\*\s*/i, ""));
    if (!overviewUrl) {
      issues.push("Overview must end with a cited URL");
    } else {
      referencedUrls.add(overviewUrl);
      if (!allowedUrls.has(overviewUrl)) {
        issues.push(`URL not allowed: ${overviewUrl}`);
      }
    }
  }

  for (const rule of SECTION_RULES) {
    const lines = sections.get(rule.heading) ?? [];
    if (!sections.has(rule.heading)) {
      issues.push(`Missing section: ${rule.heading}`);
      continue;
    }
    const bullets = bulletLines(lines);
    if (rule.min && bullets.length < rule.min) {
      issues.push(`${rule.heading} must have at least ${rule.min} bullets`);
    }
    if (rule.max && bullets.length > rule.max) {
      issues.push(`${rule.heading} must have no more than ${rule.max} bullets`);
    }
    for (const bullet of bullets) {
      const url = urlAtEnd(bullet);
      if (!url) {
        issues.push(`Bullet missing citation in ${rule.heading}: ${bullet}`);
        continue;
      }
      referencedUrls.add(url);
      if (!allowedUrls.has(url)) {
        issues.push(`URL not allowed: ${url}`);
      }
      if (rule.indexOnly && indexUrls && !indexUrls.has(url)) {
        issues.push(`Market Snapshot must use index URLs only: ${url}`);
      }
    }
  }

  const sourcesLines = sections.get("## Sources") ?? [];
  if (!sections.has("## Sources")) {
    issues.push("Missing section: ## Sources");
  }

  const sources = parseSources(sourcesLines);
  const sourcesSet = new Set(sources);

  for (const source of sourcesSet) {
    if (!allowedUrls.has(source)) {
      issues.push(`Source URL not allowed: ${source}`);
    }
    if (!referencedUrls.has(source)) {
      issues.push(`Source not referenced in body: ${source}`);
    }
  }

  for (const url of referencedUrls) {
    if (!sourcesSet.has(url)) {
      issues.push(`Referenced URL missing from sources: ${url}`);
    }
  }

  if (sourcesSet.size !== referencedUrls.size || sources.length !== sourcesSet.size) {
    issues.push("Sources list must match referenced URLs exactly");
  }

  if (issues.length > 0) {
    throw new Error(JSON.stringify(issues));
  }

  return { ...brief, status: "published", sources: Array.from(referencedUrls) };
}
