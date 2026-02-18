import crypto from "node:crypto";
import { OpenAI } from "openai";
import { requiredArticleCount } from "./prompts.js";
import type { ArticleInput } from "./prompts.js";
import {
  BriefCitedBullet,
  BriefPost,
  BriefReport,
  BriefReportAction,
  BriefSource,
  SelectedArticle,
  buildSourceId
} from "@proof/shared";
import { renderProcurementReportMarkdown } from "./render.js";
import { selectHeroArticle } from "./hero-selection.js";
import {
  ProcurementOutput,
  ProcurementPromptInput,
  buildProcurementPrompt,
  parseProcurementOutput
} from "./procurement-report.js";

const DEFAULT_MODEL = "gpt-4o";
let cachedKey: string | null = null;
let cachedClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  if (cachedClient && cachedKey === apiKey) return cachedClient;
  cachedKey = apiKey;
  cachedClient = new OpenAI({ apiKey });
  return cachedClient;
}

function getModel() {
  return process.env.OPENAI_MODEL || DEFAULT_MODEL;
}

function isReasoningModel(model?: string) {
  if (!model) return false;
  const normalized = model.toLowerCase();
  return (
    normalized.startsWith("gpt-5") ||
    normalized.startsWith("o1") ||
    normalized.startsWith("o3") ||
    normalized.startsWith("o4")
  );
}

function toIssueList(error: unknown): string[] {
  try {
    const parsed = JSON.parse((error as Error).message);
    if (Array.isArray(parsed)) return parsed.map((item) => String(item));
  } catch {
    // Ignore JSON parse failures and return a simple error list below.
  }
  return [(error as Error).message || "unknown_parse_error"];
}

function looksGenericTitle(title: string, portfolioLabel: string): boolean {
  const normalized = title.toLowerCase().trim();
  if (!normalized) return true;
  if (normalized.includes("daily brief")) return true;
  if (normalized === portfolioLabel.toLowerCase()) return true;
  if (normalized.startsWith(portfolioLabel.toLowerCase())) return true;
  return false;
}

function fallbackHeadlineFromArticle(title: string): string {
  const words = title
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 12);
  if (words.length < 8) {
    return `${words.join(" ")} Procurement pressure builds across supplier terms`.trim();
  }
  return words.join(" ");
}

function normalizeHeadlineTitle(candidate: string, agentLabel: string, fallbackSourceTitle?: string): string {
  const cleaned = candidate.replace(/\s+/g, " ").trim();
  if (!looksGenericTitle(cleaned, agentLabel) && cleaned.split(" ").length >= 8) {
    return cleaned;
  }
  if (fallbackSourceTitle) {
    return fallbackHeadlineFromArticle(fallbackSourceTitle);
  }
  return `${agentLabel} sourcing pressures shift on cost, capacity, and contract terms`;
}

function dedupeSources(sources: BriefSource[]): BriefSource[] {
  const byId = new Map<string, BriefSource>();
  for (const source of sources) {
    if (!source.sourceId || !source.url) continue;
    if (!byId.has(source.sourceId)) {
      byId.set(source.sourceId, source);
    }
  }
  return Array.from(byId.values());
}

function normalizeDedupeKey(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function dedupeCitedBullets(bullets: BriefCitedBullet[]): BriefCitedBullet[] {
  const seen = new Set<string>();
  const out: BriefCitedBullet[] = [];
  for (const bullet of bullets) {
    const key = normalizeDedupeKey(bullet.text);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(bullet);
  }
  return out;
}

function dedupeActions(actions: BriefReportAction[]): BriefReportAction[] {
  const seen = new Set<string>();
  const out: BriefReportAction[] = [];
  for (const action of actions) {
    const key = normalizeDedupeKey(action.action);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(action);
  }
  return out;
}

function citationTag(sourceIds: string[], sourceNumberById: Map<string, number>): string {
  const ordered = Array.from(new Set(sourceIds.map((sourceId) => sourceNumberById.get(sourceId)).filter(Boolean)));
  if (ordered.length === 0) return "";
  return ordered.map((value) => `[${value}]`).join("");
}

function toSummaryText(report: BriefReport, sourceNumberById: Map<string, number>): string {
  return report.summaryBullets
    .slice(0, 4)
    .map((bullet) => `${bullet.text} ${citationTag(bullet.sourceIds, sourceNumberById)}`.trim())
    .join(" ");
}

function toLegacyHighlights(report: BriefReport, sourceNumberById: Map<string, number>): string[] {
  return report.impactGroups
    .flatMap((group) =>
      group.bullets.map((bullet) => `${group.label}: ${bullet.text} ${citationTag(bullet.sourceIds, sourceNumberById)}`.trim())
    )
    .slice(0, 14);
}

function toLegacyActions(report: BriefReport, sourceNumberById: Map<string, number>): string[] {
  return report.actionGroups
    .flatMap((group) =>
      group.actions.map(
        (action) =>
          `${group.horizon} — ${action.action}. Rationale: ${action.rationale}. Owner: ${action.owner}. KPI: ${action.expectedOutcome} ${citationTag(action.sourceIds, sourceNumberById)}`.trim()
      )
    )
    .slice(0, 12);
}

function toLegacyWatchlist(report: BriefReport, sourceNumberById: Map<string, number>): string[] {
  const riskGroup = report.impactGroups.find((group) => group.label.toLowerCase().includes("risk"));
  return (riskGroup?.bullets ?? [])
    .map((bullet) => `${bullet.text} ${citationTag(bullet.sourceIds, sourceNumberById)}`.trim())
    .slice(0, 5);
}

function toDecisionSummary(report: BriefReport, sourceNumberById: Map<string, number>) {
  return {
    topMove: `${report.summaryBullets[0]?.text ?? "Monitor portfolio conditions"} ${citationTag(report.summaryBullets[0]?.sourceIds ?? [], sourceNumberById)}`.trim(),
    whatChanged: toLegacyHighlights(report, sourceNumberById).slice(0, 3),
    doNext: toLegacyActions(report, sourceNumberById).slice(0, 5),
    watchThisWeek: toLegacyWatchlist(report, sourceNumberById).slice(0, 4)
  };
}

function mapCitedBulletToSourceIds(
  bullet: { text: string; citations: number[]; signal?: "confirmed" | "early-signal" | "unconfirmed" },
  selectedByIndex: Map<number, SelectedArticle>
): BriefCitedBullet {
  return {
    text: bullet.text.trim(),
    signal: bullet.signal,
    sourceIds: bullet.citations
      .map((citation) => selectedByIndex.get(citation)?.sourceId)
      .filter((value): value is string => Boolean(value))
  };
}

function mapActionToSourceIds(
  action: { action: string; rationale: string; owner: "Category" | "Contracts" | "Legal" | "Ops"; expectedOutcome: string; citations: number[] },
  selectedByIndex: Map<number, SelectedArticle>
): BriefReportAction {
  return {
    action: action.action.trim(),
    rationale: action.rationale.trim(),
    owner: action.owner,
    expectedOutcome: action.expectedOutcome.trim(),
    sourceIds: action.citations
      .map((citation) => selectedByIndex.get(citation)?.sourceId)
      .filter((value): value is string => Boolean(value))
  };
}

async function requestJsonCompletion(
  client: OpenAI,
  prompt: string
): Promise<{ content: string; usage?: OpenAI.Chat.Completions.ChatCompletion["usage"] }> {
  const model = getModel();
  const reasoningModel = isReasoningModel(model);
  const response = await client.chat.completions.create({
    model,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    ...(reasoningModel
      ? { max_completion_tokens: 4500 }
      : { temperature: 0.2, max_tokens: 4500 })
  });

  return {
    content: response.choices?.[0]?.message?.content ?? "{}",
    usage: response.usage
  };
}

/**
 * Generates a brief from the provided articles using OpenAI.
 * Ensures exact article URLs are preserved and linked.
 */
export async function generateBrief(input: ProcurementPromptInput): Promise<BriefPost> {
  const client = getOpenAIClient();
  if (!client) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const requiredCount = Math.min(requiredArticleCount(input.agent), Math.max(1, input.articles.length));
  let parsed: ProcurementOutput | undefined;
  let repairIssues = input.repairIssues;
  let previousJson = input.previousJson;
  let lastParseIssues: string[] = [];
  let lastUsage: OpenAI.Chat.Completions.ChatCompletion["usage"] | undefined;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const prompt = buildProcurementPrompt(
      {
        ...input,
        repairIssues,
        previousJson
      },
      requiredCount
    );
    const { content: raw, usage } = await requestJsonCompletion(client, prompt);
    if (usage) lastUsage = usage;
    try {
      parsed = parseProcurementOutput(raw, {
        requiredCount,
        maxArticleIndex: input.articles.length
      });
      break;
    } catch (error) {
      lastParseIssues = toIssueList(error);
      repairIssues = lastParseIssues;
      previousJson = raw;
    }
  }

  if (!parsed) {
    throw new Error(
      JSON.stringify(
        lastParseIssues.length > 0
          ? lastParseIssues
          : ["Procurement output could not be parsed after retries"]
      )
    );
  }

  const now = new Date().toISOString();
  const regionLabel = input.region === "au" ? "Australia (Perth)" : "Americas (Houston)";

  const selectedArticles: SelectedArticle[] = parsed.selectedArticles.map((article) => {
    const idx = article.articleIndex - 1;
    const inputArticle = input.articles[idx];
    if (!inputArticle) {
      throw new Error(`Invalid articleIndex ${article.articleIndex} from LLM`);
    }
    const sourceId = buildSourceId(inputArticle.url);
    return {
      title: inputArticle.title,
      url: inputArticle.url,
      briefContent: article.briefContent,
      categoryImportance: article.categoryImportance,
      keyMetrics: article.keyMetrics,
      imageUrl: inputArticle.ogImageUrl,
      imageAlt: article.imageAlt || inputArticle.title,
      sourceName: inputArticle.sourceName,
      publishedAt: inputArticle.publishedAt,
      sourceIndex: article.articleIndex,
      sourceId
    };
  });

  const selectedByIndex = new Map<number, SelectedArticle>(selectedArticles.map((article) => [article.sourceIndex ?? 0, article]));
  const heroArticle = selectHeroArticle(selectedArticles, parsed.heroSelection.articleIndex);

  const marketIndicators = parsed.marketIndicators
    .map((m) => {
      const match = input.indices.find((idx) => idx.id === m.indexId);
      if (!match) return null;
      return { id: match.id, label: match.label, url: match.url, note: m.note || "" };
    })
    .filter((m): m is NonNullable<typeof m> => Boolean(m));

  const report: BriefReport = {
    summaryBullets: dedupeCitedBullets(parsed.summaryBullets.map((bullet) => mapCitedBulletToSourceIds(bullet, selectedByIndex))),
    impactGroups: [
      {
        label: "Market/Cost drivers",
        bullets: dedupeCitedBullets(parsed.impact.marketCostDrivers.map((bullet) => mapCitedBulletToSourceIds(bullet, selectedByIndex)))
      },
      {
        label: "Supply base & capacity",
        bullets: dedupeCitedBullets(parsed.impact.supplyBaseCapacity.map((bullet) => mapCitedBulletToSourceIds(bullet, selectedByIndex)))
      },
      {
        label: "Contracting & commercial terms",
        bullets: dedupeCitedBullets(
          parsed.impact.contractingCommercialTerms.map((bullet) => mapCitedBulletToSourceIds(bullet, selectedByIndex))
        )
      },
      {
        label: "Risk & regulatory / operational constraints",
        bullets: dedupeCitedBullets(
          parsed.impact.riskRegulatoryOperationalConstraints.map((bullet) => mapCitedBulletToSourceIds(bullet, selectedByIndex))
        )
      }
    ],
    actionGroups: [
      {
        horizon: "Next 72 hours",
        actions: dedupeActions(parsed.possibleActions.next72Hours.map((action) => mapActionToSourceIds(action, selectedByIndex)))
      },
      {
        horizon: "Next 2-4 weeks",
        actions: dedupeActions(parsed.possibleActions.next2to4Weeks.map((action) => mapActionToSourceIds(action, selectedByIndex)))
      },
      {
        horizon: "Next quarter",
        actions: dedupeActions(parsed.possibleActions.nextQuarter.map((action) => mapActionToSourceIds(action, selectedByIndex)))
      }
    ]
  };

  const selectedSources: BriefSource[] = selectedArticles.map((article) => ({
    sourceId: article.sourceId ?? buildSourceId(article.url),
    url: article.url,
    title: article.title,
    publishedAt: article.publishedAt,
    retrievedAt: now
  }));

  const indicatorSources: BriefSource[] = marketIndicators.map((indicator) => ({
    sourceId: buildSourceId(indicator.url),
    url: indicator.url,
    title: indicator.label,
    retrievedAt: now
  }));

  const selectedArticleIndexes = new Set(selectedArticles.map((article) => article.sourceIndex));
  const supplementalSources: BriefSource[] = input.articles
    .map((article, index) => ({ article, index: index + 1 }))
    .filter(({ index }) => !selectedArticleIndexes.has(index))
    .slice(0, 20)
    .map(({ article }) => ({
      sourceId: buildSourceId(article.url),
      url: article.url,
      title: article.title,
      publishedAt: article.publishedAt,
      retrievedAt: now
    }));

  const allSources = dedupeSources([...selectedSources, ...indicatorSources, ...supplementalSources]).slice(0, 20);
  const sourceNumberById = new Map(allSources.map((source, index) => [source.sourceId, index + 1]));

  const summary = toSummaryText(report, sourceNumberById);
  const highlights = toLegacyHighlights(report, sourceNumberById);
  const procurementActions = toLegacyActions(report, sourceNumberById);
  const watchlist = toLegacyWatchlist(report, sourceNumberById);

  const headlineTitle = normalizeHeadlineTitle(
    parsed.title,
    input.agent.label,
    selectedArticles[0]?.title ?? input.articles[0]?.title
  );

  const bodyMarkdown = renderProcurementReportMarkdown({
    title: headlineTitle,
    regionLabel,
    portfolioLabel: input.agent.label,
    runWindow: input.runWindow,
    publishedAtISO: now,
    region: input.region,
    report,
    sources: allSources
  });
  const llmUsage = lastUsage
    ? {
        promptTokens: lastUsage.prompt_tokens,
        completionTokens: lastUsage.completion_tokens,
        totalTokens: lastUsage.total_tokens
      }
    : undefined;

  return {
    postId: crypto.randomUUID(),
    title: headlineTitle,
    region: input.region,
    portfolio: input.agent.portfolio,
    runWindow: input.runWindow,
    status: "draft",
    publishedAt: now,
    summary,
    bodyMarkdown,
    sources: allSources,
    highlights,
    procurementActions,
    watchlist,
    deltaSinceLastRun: highlights.slice(0, 4),
    marketIndicators,
    selectedArticles,
    heroImageUrl: heroArticle?.imageUrl,
    heroImageSourceUrl: heroArticle?.url,
    heroImageAlt: heroArticle?.title || headlineTitle,
    decisionSummary: toDecisionSummary(report, sourceNumberById),
    report,
    llmUsage
  };
}

export type { ProcurementPromptInput as PromptInput, ArticleInput };
