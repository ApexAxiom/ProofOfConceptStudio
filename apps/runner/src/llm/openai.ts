import crypto from "node:crypto";
import { OpenAI } from "openai";
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
  const configured = process.env.OPENAI_MODEL?.trim();
  if (!configured) {
    throw new Error("OPENAI_MODEL is required for runner LLM calls");
  }
  return configured;
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

function normalizeComparableText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s%./-]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitSentences(text?: string): string[] {
  const normalized = (text ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  return (normalized.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [])
    .map((sentence) => sentence.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function cleanStoryText(text?: string, title?: string): string {
  let cleaned = (text ?? "")
    .replace(/\bCredit:\s*[^.]+\.?/gi, " ")
    .replace(/\b(?:Photo|Image) credit:\s*[^.]+\.?/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  cleaned = cleaned.replace(/^home\b[^.?!]*\s+/i, "").trim();
  cleaned = cleaned.replace(/^[|:\-–—\s]+/, "").trim();

  if (title) {
    const normalizedTitle = normalizeComparableText(title);
    const normalizedCleaned = normalizeComparableText(cleaned);
    if (normalizedTitle && normalizedCleaned.startsWith(normalizedTitle)) {
      const remainder = cleaned.slice(title.length).replace(/^[|:\-–—\s]+/, "").trim();
      if (remainder.length >= 40) cleaned = remainder;
    }
  }

  return cleaned;
}

function isLowValueKeyFact(text?: string): boolean {
  const cleaned = (text ?? "").replace(/\s+/g, " ").trim();
  if (!cleaned) return true;
  if (!/[a-z]/i.test(cleaned)) return true;
  if (/^(19|20)\d{2}$/.test(cleaned)) return true;
  if (/^\d[\d.,%/$-]*$/.test(cleaned)) return true;
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 1 && /\d/.test(words[0])) return true;
  return cleaned.length < 8;
}

function isGenericCategoryImportance(text?: string): boolean {
  const cleaned = (text ?? "").trim();
  if (!cleaned) return true;
  return /signal relevance for sourcing, contract, or supplier-risk decisions in this category/i.test(cleaned);
}

function isWeakStoryNarrative(text: string, title: string): boolean {
  if (!text || text.length < 90) return true;
  if (/^home\b/i.test(text) || /\bshutterstock\b/i.test(text)) return true;
  const normalizedTitle = normalizeComparableText(title);
  const normalizedText = normalizeComparableText(text);
  if (!normalizedText) return true;
  if (normalizedText === normalizedTitle) return true;
  if (normalizedText.startsWith(normalizedTitle) && splitSentences(text).length < 2) return true;
  return false;
}

function clipFact(text: string, maxLength = 96): string {
  const cleaned = text.replace(/\s+/g, " ").replace(/[.]+$/, "").trim();
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, maxLength - 3).trim()}...`;
}

function scoreSentence(sentence: string): number {
  let score = 0;
  if (/\d|%|\$|€|£|¥|million|billion|mmbtu|bbl|well|rig|contract|award|target|planned|days?|pilot|first|capacity/i.test(sentence)) score += 4;
  if (/\b(start|begins?|launch|award|sign|extend|target|plan|pilot|raise|cut|delay|expand|restart|mobili[sz]e)\b/i.test(sentence)) score += 3;
  if (sentence.length >= 40 && sentence.length <= 180) score += 1;
  if (/^by\b/i.test(sentence)) score -= 2;
  return score;
}

function deriveKeyFactsFromArticle(article: ArticleInput, maxItems = 4): string[] {
  const sentences = splitSentences(cleanStoryText(article.content, article.title));
  const ranked = [...sentences]
    .filter((sentence) => !/^by\b/i.test(sentence))
    .sort((a, b) => scoreSentence(b) - scoreSentence(a));
  const facts: string[] = [];
  const seen = new Set<string>();

  for (const sentence of ranked) {
    const fact = clipFact(sentence);
    const key = normalizeComparableText(fact);
    if (!key || seen.has(key) || isLowValueKeyFact(fact)) continue;
    seen.add(key);
    facts.push(fact);
    if (facts.length >= maxItems) break;
  }

  if (facts.length === 0) {
    const fallbackTitle = clipFact(article.title, 88);
    if (!isLowValueKeyFact(fallbackTitle)) facts.push(fallbackTitle);
  }

  return facts;
}

function buildFallbackStoryNarrative(article: ArticleInput): string {
  const cleanedContent = cleanStoryText(article.content, article.title);
  const sentences = splitSentences(cleanedContent)
    .filter((sentence) => !/^by\b/i.test(sentence))
    .sort((a, b) => scoreSentence(b) - scoreSentence(a))
    .slice(0, 2);

  if (sentences.length > 0) {
    return sentences.join(" ").slice(0, 520);
  }

  return `${article.title}. This looks relevant, but the source extract was too thin to support a deeper write-up.`;
}

function buildFallbackCategoryImportance(article: ArticleInput, categoryLabel: string): string {
  const text = `${article.title} ${article.content ?? ""}`;
  if (/\bprice|cost|dayrate|index|premium|inflation|steel|oil\b/i.test(text)) {
    return `For ${categoryLabel}, the read-through is mainly cost discipline: refresh bid assumptions and challenge any fast repricing with current evidence.`;
  }
  if (/\bcapacity|availability|lead time|slot|backlog|rig|vessel|crew|supply\b/i.test(text)) {
    return `For ${categoryLabel}, this is mainly a capacity signal: check where supplier availability, sequencing, or fallback coverage could tighten.`;
  }
  if (/\bcontract|award|tender|bid|renewal|agreement|commercial\b/i.test(text)) {
    return `For ${categoryLabel}, the useful takeaway is commercial leverage: contract structure and timing may matter as much as headline pricing.`;
  }
  if (/\bregulation|policy|permit|tariff|sanction|compliance\b/i.test(text)) {
    return `For ${categoryLabel}, this is a policy and compliance read-through: keep room for pass-through, qualification, and supplier eligibility changes.`;
  }
  if (/\bdelay|timeline|schedule|mobili[sz]e|delivery|window\b/i.test(text)) {
    return `For ${categoryLabel}, this is mainly a schedule signal: watch for knock-on effects on delivery windows, expediting pressure, and sequencing risk.`;
  }
  return `For ${categoryLabel}, this is useful mainly as context for supplier conversations and near-term watch items, not as an automatic escalation by itself.`;
}

function normalizeKeyFacts(rawFacts: string[] | undefined, article: ArticleInput): string[] {
  const normalized = Array.from(
    new Set(
      (rawFacts ?? [])
        .map((fact) => clipFact(cleanStoryText(fact, article.title)))
        .filter((fact) => !isLowValueKeyFact(fact))
    )
  ).slice(0, 4);

  if (normalized.length >= 2) return normalized;

  const derived = deriveKeyFactsFromArticle(article, 4);
  return Array.from(new Set([...normalized, ...derived])).slice(0, 4);
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

function dedupeReportDuplicateBullets(report: BriefReport, deltaSinceLastRun: string[]): string[] {
  const seen = new Set<string>();

  const dedupe = <T extends { text: string }>(items: T[]): T[] => {
    const out: T[] = [];
    for (const item of items) {
      const key = normalizeComparableText(item.text);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(item);
    }
    return out;
  };

  report.summaryBullets = dedupe(report.summaryBullets);
  report.impactGroups = report.impactGroups.map((group) => ({
    ...group,
    bullets: dedupe(group.bullets)
  }));

  return deltaSinceLastRun
    .map((item) => ({
      item,
      key: normalizeComparableText(item)
    }))
    .filter((entry) => {
      if (!entry.key || seen.has(entry.key)) return false;
      seen.add(entry.key);
      return true;
    })
    .map((entry) => entry.item)
    .slice(0, 3);
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

function isUsableStoryCandidate(article: ArticleInput): boolean {
  const contentLength = (article.content ?? "").trim().length;
  return article.contentStatus !== "thin" && contentLength >= 300;
}

function preferredSelectedArticleCount(input: ProcurementPromptInput): number {
  const available = Math.max(1, input.articles.length);
  const usableCount = input.articles.filter(isUsableStoryCandidate).length;
  const lightSignalDay = input.newsStatus === "thin-category" || input.newsStatus === "fallback-context" || usableCount < 3;

  if (lightSignalDay) {
    return Math.min(3, available);
  }

  if (usableCount >= 5 && available >= 5) return 5;
  if (usableCount >= 4 && available >= 4) return 4;
  return Math.min(Math.max(3, usableCount), available);
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

  const requiredCount = preferredSelectedArticleCount(input);
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
    const repairedBriefContent = cleanStoryText(article.briefContent, inputArticle.title);
    const repairedCategoryImportance = cleanStoryText(article.categoryImportance, inputArticle.title);
    return {
      title: inputArticle.title,
      url: inputArticle.url,
      briefContent: isWeakStoryNarrative(repairedBriefContent, inputArticle.title)
        ? buildFallbackStoryNarrative(inputArticle)
        : repairedBriefContent,
      categoryImportance: isGenericCategoryImportance(repairedCategoryImportance)
        ? buildFallbackCategoryImportance(inputArticle, input.agent.label)
        : repairedCategoryImportance,
      keyMetrics: normalizeKeyFacts(article.keyMetrics, inputArticle),
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

  const deltaSinceLastRun = dedupeReportDuplicateBullets(report, parsed.deltaSinceLastRun ?? []);

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
  const allSources = dedupeSources([...selectedSources, ...indicatorSources]).slice(0, 20);
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
    deltaSinceLastRun,
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
