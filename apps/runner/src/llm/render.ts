import {
  BriefMarketIndicator,
  BriefReport,
  BriefSource,
  RegionSlug,
  REGIONS,
  SelectedArticle
} from "@proof/shared";

interface RenderParams {
  title: string;
  summary: string;
  regionLabel: string;
  portfolioLabel: string;
  runWindow: string;
  publishedAtISO: string;
  selectedArticles: SelectedArticle[];
  marketIndicators: BriefMarketIndicator[];
  highlights?: string[];
  procurementActions?: string[];
  watchlist?: string[];
  deltaSinceLastRun?: string[];
  topStoriesTitle?: string;
  region: RegionSlug;
}

/**
 * Formats a date string to region-specific timezone (CST for us-mx-la-lng, AWST for au)
 */
function formatDateForRegion(dateStr: string, region: RegionSlug): string {
  const date = new Date(dateStr);
  const timeZone = REGIONS[region].timeZone;
  const timeZoneLabel = region === "au" ? "AWST" : "CST";
  
  return date.toLocaleString("en-US", {
    timeZone,
    dateStyle: "medium",
    timeStyle: "short",
    hour12: true
  }) + ` ${timeZoneLabel}`;
}

/**
 * Renders a deterministic markdown body for briefs with explicit source links.
 */
export function renderBriefMarkdown({
  title,
  summary,
  regionLabel,
  portfolioLabel,
  runWindow,
  publishedAtISO,
  selectedArticles,
  marketIndicators,
  highlights = [],
  procurementActions = [],
  watchlist = [],
  deltaSinceLastRun = [],
  topStoriesTitle = "## 📰 Top Stories",
  region
}: RenderParams): string {
  const publishedAt = formatDateForRegion(publishedAtISO, region);
  const lines: string[] = [];

  lines.push(`# ${title}`);
  lines.push("", `**Region:** ${regionLabel}`, `**Portfolio:** ${portfolioLabel}`, `**Edition:** ${runWindow.toUpperCase()}`);
  lines.push(`**Published:** ${publishedAt}`);

  lines.push("", "## 📌 Executive Summary", "", summary.trim());

  if (highlights.length > 0) {
    lines.push("", "## ⚡ Market Highlights");
    highlights.forEach((item) => lines.push(`- ${item}`));
  }

  if (procurementActions.length > 0) {
    lines.push("", "## 🛠️ Procurement Actions");
    procurementActions.forEach((item) => lines.push(`- ${item}`));
  }

  if (watchlist.length > 0) {
    lines.push("", "## 👀 Watchlist");
    watchlist.forEach((item) => lines.push(`- ${item}`));
  }

  if (deltaSinceLastRun.length > 0) {
    lines.push("", "## 🔄 Changes Since Last Brief");
    deltaSinceLastRun.forEach((item) => lines.push(`- ${item}`));
  }

  lines.push("", "---", "", topStoriesTitle);

  selectedArticles.forEach((article, idx) => {
    lines.push("", `### ${idx + 1}. ${article.title}`);
    
    // Article published date with timezone
    if (article.publishedAt) {
      const articleDate = formatDateForRegion(article.publishedAt, region);
      lines.push("", `📅 **Published:** ${articleDate}`);
    }
    
    // Key metrics if available
    if (article.keyMetrics && article.keyMetrics.length > 0) {
      lines.push("", `📊 **Key Data:** ${article.keyMetrics.join(" • ")}`);
    }
    
    lines.push("", article.briefContent.trim());
    
    // Category importance callout
    if (article.categoryImportance) {
      lines.push("", `> 💡 **Why This Matters:** ${article.categoryImportance}`);
    }
    
    lines.push("", `**Source:** [${article.title}](${article.url})`);
    lines.push("", "---");
  });

  if (marketIndicators.length > 0) {
    lines.push("", "## 📊 Market Indicators");
    for (const indicator of marketIndicators) {
      lines.push(`- **${indicator.label}**: ${indicator.note} ([Source](${indicator.url}))`);
    }
  }

  lines.push("", "---", "", "## 📎 All Sources");
  for (const article of selectedArticles) {
    lines.push(`- [${article.title}](${article.url})`);
  }
  for (const indicator of marketIndicators) {
    lines.push(`- [${indicator.label}](${indicator.url})`);
  }

  return lines.join("\n\n");
}

interface RenderProcurementReportParams {
  title: string;
  regionLabel: string;
  portfolioLabel: string;
  runWindow: string;
  publishedAtISO: string;
  region: RegionSlug;
  report: BriefReport;
  sources: BriefSource[];
}

function citationTag(sourceIds: string[], numberBySourceId: Map<string, number>): string {
  const numbers = Array.from(new Set(sourceIds.map((sourceId) => numberBySourceId.get(sourceId)).filter(Boolean)));
  if (numbers.length === 0) return "";
  return numbers.map((value) => `[${value}]`).join("");
}

/**
 * Renders the structured procurement report markdown in the required 4-section format.
 */
export function renderProcurementReportMarkdown({
  title,
  regionLabel,
  portfolioLabel,
  runWindow,
  publishedAtISO,
  region,
  report,
  sources
}: RenderProcurementReportParams): string {
  const publishedAt = formatDateForRegion(publishedAtISO, region);
  const numberedSources = sources.map((source, index) => ({ ...source, number: index + 1 }));
  const numberBySourceId = new Map(numberedSources.map((source) => [source.sourceId, source.number]));
  const lines: string[] = [];

  lines.push(`# ${title}`);
  lines.push("", `**Region:** ${regionLabel}`, `**Portfolio:** ${portfolioLabel}`, `**Edition:** ${runWindow.toUpperCase()}`);
  lines.push(`**Published:** ${publishedAt}`);

  lines.push("", "## Summary");
  for (const bullet of report.summaryBullets) {
    lines.push(`- ${bullet.text} ${citationTag(bullet.sourceIds, numberBySourceId)}`.trim());
  }

  lines.push("", "## Impact");
  for (const group of report.impactGroups) {
    lines.push(`### ${group.label}`);
    for (const bullet of group.bullets) {
      lines.push(`- ${bullet.text} ${citationTag(bullet.sourceIds, numberBySourceId)}`.trim());
    }
    lines.push("");
  }

  lines.push("## Possible actions");
  for (const group of report.actionGroups) {
    lines.push(`### ${group.horizon}`);
    for (const action of group.actions) {
      const refs = citationTag(action.sourceIds, numberBySourceId);
      lines.push(`- **Action:** ${action.action}`);
      lines.push(`  - **Rationale:** ${action.rationale}`);
      lines.push(`  - **Owner:** ${action.owner}`);
      lines.push(`  - **Expected outcome / KPI:** ${action.expectedOutcome} ${refs}`.trim());
    }
    lines.push("");
  }

  lines.push("## Sources");
  for (const source of numberedSources) {
    let publisher = "";
    try {
      publisher = source.url ? new URL(source.url).hostname.replace(/^www\./, "") : "";
    } catch {
      publisher = "";
    }
    const date = source.publishedAt
      ? new Date(source.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      : "n.d.";
    const titleOrDomain = source.title?.trim() || publisher || source.url;
    lines.push(`${source.number}. ${titleOrDomain} — ${publisher || "Source"} (${date}) — ${source.url}`);
  }

  return lines.join("\n");
}
