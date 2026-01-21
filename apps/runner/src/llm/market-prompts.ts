import { AgentConfig, CategoryGroup, MarketIndex, RegionSlug, RunWindow } from "@proof/shared";
import { requiredArticleCount } from "./prompts.js";

export interface MarketCandidate {
  title: string;
  url: string;
  briefContent: string;
  portfolio?: string;
  categoryGroup?: CategoryGroup;
  sourceName?: string;
  imageUrl?: string;
}

export interface MarketPromptInput {
  agent: AgentConfig;
  region: RegionSlug;
  runWindow: RunWindow;
  candidates: MarketCandidate[];
  indices: MarketIndex[];
  repairIssues?: string[];
  previousJson?: string;
}

export interface MarketOutput {
  title: string;
  summary: string;
  highlights: string[];
  procurementActions: string[];
  watchlist: string[];
  selectedArticles: Array<{ candidateIndex: number; whySelected: string; imageAlt?: string }>;
  heroCandidateIndex: number;
  marketIndicators: Array<{ indexId: string; note: string }>;
}

export function buildMarketPrompt(input: MarketPromptInput): string {
  const requiredCount = Math.min(requiredArticleCount(input.agent), Math.max(1, input.candidates.length));
  const regionName = input.region === "au" ? "Australia (Perth)" : "Americas (Houston)";
  const candidateList = input.candidates
    .map(
      (c, idx) => `### Candidate ${idx + 1}${c.sourceName ? ` (${c.sourceName})` : ""}${c.categoryGroup ? ` [${c.categoryGroup}]` : ""}${c.portfolio ? ` (${c.portfolio})` : ""}
Title: ${c.title}
URL: ${c.url}
Summary: ${c.briefContent.slice(0, 600)}`
    )
    .join("\n---\n");

  const indexList = input.indices
    .map((idx) => `- ${idx.id}: ${idx.label} — ${idx.url}${idx.notes ? ` (${idx.notes})` : ""}`)
    .join("\n");

  const repairSection = input.repairIssues
    ? `
## ⚠️ REPAIR REQUIRED

Fix these issues from your last attempt:
${input.repairIssues.map((i) => `- ${i}`).join("\n")}

Previous JSON to fix:
\`\`\`json
${input.previousJson}
\`\`\`

Rules:
- ONLY reference candidateIndex values from the list
- Do NOT output URLs or titles not provided
- Keep indices unique and heroCandidateIndex within selectedArticles
`
    : "";

  return `# Market Dashboard Brief

You are generating an **Oil & Gas / LNG Market Dashboard** for ${regionName} (${input.runWindow.toUpperCase()}).

## OBJECTIVE
- Surface cross-category signals using the most relevant ${requiredCount} source articles.
- Provide executive highlights, procurement actions, and a watchlist.
- Select market indicators by indexId. Do NOT output URLs.

## OUTPUT JSON FORMAT
\`\`\`json
{
  "title": "Dashboard headline",
  "summary": "2 sentence executive summary",
  "highlights": ["bullet 1", "bullet 2"],
  "procurementActions": ["action 1", "action 2"],
  "watchlist": ["item 1"],
  "selectedArticles": [
    { "candidateIndex": 1, "whySelected": "1 sentence context (must end with a source tag or (analysis))", "imageAlt": "..." }
  ],
  "heroCandidateIndex": 1,
  "marketIndicators": [ { "indexId": "cme-wti", "note": "1 sentence" } ]
}
\`\`\`

## CRITICAL RULES
1. Use ONLY candidateIndex values from 1..${input.candidates.length}. Do NOT output URLs.
2. Select exactly ${requiredCount} unique candidateIndex values.
3. heroCandidateIndex must be one of the selected candidateIndex values.
4. Market indicators must reference indexId from the list below (no URLs in JSON).
5. Every sentence/bullet in summary, highlights, procurementActions, watchlist, and selectedArticles.whySelected MUST end with "(source: candidateIndex N)" or "(analysis)".
6. Any item that contains numeric tokens MUST end with "(source: candidateIndex N)" where N is a selected candidateIndex.
7. If a statement is not directly supported by the candidate summaries, end it with "(analysis)" and include NO numeric tokens.

## MARKET INDICES (select by indexId)
${indexList}

## CANDIDATE ARTICLES
${candidateList}

${repairSection}
`;
}

export function parseMarketOutput(raw: string, requiredCount: number, maxIndex: number): MarketOutput {
  const parsed = JSON.parse(raw);
  const selected = Array.isArray(parsed.selectedArticles) ? parsed.selectedArticles : [];
  const issues: string[] = [];
  const indices = new Set<number>();

  for (const item of selected) {
    const idx = Number(item.candidateIndex);
    if (!Number.isInteger(idx) || idx < 1 || idx > maxIndex) {
      issues.push("Each selectedArticles entry must have a valid candidateIndex");
      continue;
    }
    indices.add(idx);
  }

  if (selected.length !== requiredCount) {
    issues.push(`Must select exactly ${requiredCount} candidate articles`);
  }

  if (indices.size !== selected.length) {
    issues.push("candidateIndex values must be unique");
  }

  if (!indices.has(parsed.heroCandidateIndex)) {
    issues.push("heroCandidateIndex must reference a selected candidateIndex");
  }

  const marketIndicators = Array.isArray(parsed.marketIndicators) ? parsed.marketIndicators : [];

  if (issues.length > 0) {
    throw new Error(JSON.stringify(issues));
  }

  return {
    title: parsed.title || "Market Dashboard",
    summary: parsed.summary || "",
    highlights: parsed.highlights || [],
    procurementActions: parsed.procurementActions || [],
    watchlist: parsed.watchlist || [],
    selectedArticles: selected.map((s: any) => ({
      candidateIndex: Number(s.candidateIndex),
      whySelected: s.whySelected || "",
      imageAlt: s.imageAlt
    })),
    heroCandidateIndex: Number(parsed.heroCandidateIndex),
    marketIndicators: marketIndicators.map((m: any) => ({ indexId: m.indexId, note: m.note || "" }))
  };
}
