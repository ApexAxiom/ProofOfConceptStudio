import { BriefPost } from "@proof/shared";

const SECTION_RULES = [
  { heading: "## 3 Takeaways", min: 3, max: 3 },
  { heading: "## Market Snapshot", min: 3, max: undefined, indexOnly: true },
  { heading: "## Developments", min: 5, max: 10 },
  { heading: "## Procurement Impact", min: 3 },
  { heading: "## Recommended Actions", min: 1, max: 3 }
];

function extractSection(body: string, heading: string) {
  const pattern = new RegExp(`${heading}\\s*\\n([\\s\\S]*?)(?=^##\\s|\\n\\z)`, "m");
  const match = body.match(pattern);
  return match?.[1]?.trim() ?? "";
}

function parseBulletLines(section: string): string[] {
  return section
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("- "));
}

export function validateBrief(brief: BriefPost, allowedUrls: Set<string>, indexUrls?: Set<string>): BriefPost {
  const issues: string[] = [];
  const body = brief.bodyMarkdown || "";
  if (!body) issues.push("Body markdown is empty");

  const referencedUrls = new Set<string>();

  for (const rule of SECTION_RULES) {
    const sectionText = extractSection(body, rule.heading);
    if (!sectionText) {
      issues.push(`Missing section: ${rule.heading}`);
      continue;
    }
    const bullets = parseBulletLines(sectionText);
    if (rule.min && bullets.length < rule.min) {
      issues.push(`${rule.heading} must have at least ${rule.min} bullets`);
    }
    if (rule.max && bullets.length > rule.max) {
      issues.push(`${rule.heading} must have no more than ${rule.max} bullets`);
    }
    for (const bullet of bullets) {
      const match = bullet.match(/\\(https?:\\/\\/[^\\s)]+\\)\\s*$/);
      if (!match) {
        issues.push(`Bullet missing citation in ${rule.heading}: ${bullet}`);
        continue;
      }
      const url = match[0].replace(/[()]/g, "");
      referencedUrls.add(url);
      if (!allowedUrls.has(url)) {
        issues.push(`URL not allowed: ${url}`);
      }
      if (rule.indexOnly && indexUrls && !indexUrls.has(url)) {
        issues.push(`Market Snapshot must use index URLs only: ${url}`);
      }
    }
  }

  const sourcesSection = extractSection(body, "## Sources");
  if (!sourcesSection) {
    issues.push("Missing section: ## Sources");
  }
  const sources = sourcesSection
    .split("\n")
    .map((s) => s.replace(/^-\s*/, "").trim())
    .filter(Boolean);
  for (const source of sources) {
    if (!allowedUrls.has(source)) {
      issues.push(`Source URL not allowed: ${source}`);
    }
    if (!referencedUrls.has(source)) {
      issues.push(`Source not referenced in body: ${source}`);
    }
  }
  if (sources.length !== referencedUrls.size) {
    issues.push("Sources list must match referenced URLs exactly");
  }

  if (issues.length > 0) {
    throw new Error(JSON.stringify(issues));
  }

  return { ...brief, status: "published", sources: Array.from(referencedUrls) };
}
