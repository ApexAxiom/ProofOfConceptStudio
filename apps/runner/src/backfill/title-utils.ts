import { BriefPost, portfolioLabel } from "@proof/shared";

const GENERIC_TITLE_PATTERNS = [
  /daily brief/i,
  /brief -/i,
  /brief$/i
];

function cleanText(input: string): string {
  return input
    .replace(/<[^>]+>/g, " ")
    .replace(/\[[^\]]+\]\([^)]+\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenized(input: string): string[] {
  return cleanText(input)
    .replace(/[^a-zA-Z0-9%$+\-\/\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function isGenericBriefTitle(title: string | undefined, portfolio: string): boolean {
  const value = (title ?? "").trim();
  if (!value) return true;
  const lower = value.toLowerCase();
  if (GENERIC_TITLE_PATTERNS.some((pattern) => pattern.test(value))) return true;
  if (lower === portfolio.toLowerCase()) return true;
  if (lower === portfolioLabel(portfolio).toLowerCase()) return true;
  if (lower.startsWith(`${portfolioLabel(portfolio).toLowerCase()} -`)) return true;
  if (lower.startsWith(`${portfolioLabel(portfolio).toLowerCase()} —`)) return true;
  return false;
}

function normalizeHeadlineWordCount(words: string[]): string {
  const clipped = words.slice(0, 14);
  if (clipped.length >= 8) return clipped.join(" ");
  const padded = [
    ...clipped,
    "drives",
    "cost",
    "and",
    "supplier",
    "terms",
    "for",
    "procurement"
  ].slice(0, 12);
  return padded.join(" ");
}

export function buildHeadlineTitle(brief: BriefPost): string {
  const candidatePool = [
    brief.selectedArticles?.[0]?.title,
    brief.highlights?.[0],
    brief.summary,
    brief.decisionSummary?.topMove,
    brief.bodyMarkdown
  ].filter((value): value is string => Boolean(value && value.trim()));

  const numericHint =
    [brief.summary, ...(brief.highlights ?? []), ...(brief.procurementActions ?? [])]
      .join(" ")
      .match(/([+\-]?\d+(?:\.\d+)?%|\$[0-9,.]+|[0-9,.]+\s?(?:bpd|kb\/d|MMBtu|mtpa|tons?|contracts?))/i)?.[1] ?? "";

  for (const candidate of candidatePool) {
    const words = tokenized(candidate);
    if (words.length < 4) continue;
    let title = normalizeHeadlineWordCount(words);
    if (numericHint && !title.includes(numericHint)) {
      title = normalizeHeadlineWordCount([...tokenized(title), numericHint]);
    }
    if (!isGenericBriefTitle(title, brief.portfolio)) {
      return title;
    }
  }

  const fallbackWords = tokenized(`${portfolioLabel(brief.portfolio)} procurement pressure shifts on cost and supply`);
  return normalizeHeadlineWordCount(fallbackWords);
}
