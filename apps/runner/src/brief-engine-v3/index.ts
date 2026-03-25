import {
  AgentConfig,
  AgentFramework,
  BriefCitedBullet,
  BriefMarketIndicator,
  BriefPost,
  BriefReport,
  BriefReportAction,
  BriefSource,
  CmSnapshot,
  DecisionSummary,
  MarketIndex,
  RegionSlug,
  RunWindow,
  SelectedArticle,
  VpConfidence,
  VpHorizon,
  VpSignalType,
  buildSourceId,
  dedupeSources,
  getAgentFramework,
  makeCategoryPlaceholderDataUrl,
  validateBriefV2Record
} from "@proof/shared";
import { OpenAI } from "openai";
import { buildTopStories, deriveDeltaSinceLastRun } from "../brief-v2.js";
import {
  ArticleInput,
  BriefOutput,
  buildPrompt,
  parsePromptOutput,
  requiredArticleCount
} from "../llm/prompts.js";
import { renderBriefMarkdown } from "../llm/render.js";
import { parseEvidenceTag, stripEvidenceTag } from "../publish/factuality.js";

export type GenerateBriefV3Input = {
  agent: AgentConfig;
  region: RegionSlug;
  runWindow: RunWindow;
  articles: ArticleInput[];
  indices: MarketIndex[];
  previousBrief?: BriefPost | null;
  nowIso: string;
  runIdentity: { runId: string; briefDay: string };
  config?: { openaiClient?: OpenAI | null; model?: string; allowLlm?: boolean };
};

/** Deterministic brief generation pipeline that always returns a publishable v2 record. */
export async function generateBriefV3(input: GenerateBriefV3Input): Promise<BriefPost> {
  const normalized = normalizeArticles(input.articles);
  const seeded = ensureSeedArticles(normalized, input.previousBrief, input.indices, input.agent.label);
  const selected = selectTopStoriesDeterministic(seeded, 3);
  const selectedInputs = mapSelectedInputs(seeded, selected);
  const enriched = (await callLLMEnriched({ ...input, selectedInputs })) ?? buildHeuristicBriefOutput({ ...input, selectedInputs });
  const assembled = assembleBriefPost({ ...input, selected, selectedInputs, enriched });
  const repaired = validateHardAndRepair(assembled, input.previousBrief);
  return validateSoft(repaired, repaired.selectedArticles ?? selected);
}

type Theme = "cost" | "supply" | "commercial" | "regulatory" | "schedule" | "general";

function normalizeArticles(articles: ArticleInput[]): ArticleInput[] {
  const seen = new Set<string>();
  return articles
    .map((article) => ({ ...article, url: article.url?.trim() ?? "", title: article.title?.trim() ?? "" }))
    .filter((article) => article.url && article.title)
    .filter((article) => {
      const key = article.url.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function ensureSeedArticles(articles: ArticleInput[], previousBrief: BriefPost | null | undefined, indices: MarketIndex[], agentLabel: string): ArticleInput[] {
  if (articles.length > 0) return articles;
  const fromPrevious = (previousBrief?.selectedArticles ?? []).slice(0, 3).map((article) => ({
    title: article.title,
    url: article.url,
    content: `${article.briefContent ?? article.categoryImportance ?? article.title}`,
    sourceName: article.sourceName,
    publishedAt: article.publishedAt,
    ogImageUrl: article.imageUrl
  }));
  if (fromPrevious.length > 0) return fromPrevious;
  const index = indices[0];
  if (index) {
    return [{
      title: `${agentLabel} index context update`,
      url: index.url,
      content: `${index.label}: ${index.notes ?? "Market reference index used as source-of-record for a low-coverage cycle."}`,
      sourceName: "Market Index",
      publishedAt: new Date().toISOString()
    }];
  }
  return [];
}

function mapSelectedInputs(articles: ArticleInput[], selected: SelectedArticle[]): ArticleInput[] {
  const articleByUrl = new Map(articles.map((article) => [article.url, article]));
  return selected.map((story) => articleByUrl.get(story.url) ?? {
    title: story.title,
    url: story.url,
    content: story.briefContent,
    sourceName: story.sourceName,
    publishedAt: story.publishedAt,
    ogImageUrl: story.imageUrl
  });
}

function scoreArticle(article: ArticleInput, idx: number): number {
  const recency = article.publishedAt ? Math.max(0, 100 - Math.floor((Date.now() - new Date(article.publishedAt).getTime()) / 3_600_000)) : 0;
  const length = Math.min(50, Math.floor((article.content?.length ?? 0) / 80));
  const numeric = /\d/.test(article.content ?? "") ? 10 : 0;
  return recency + length + numeric - idx;
}

function selectTopStoriesDeterministic(articles: ArticleInput[], limit: number): SelectedArticle[] {
  return [...articles]
    .map((article, idx) => ({ article, score: scoreArticle(article, idx), idx }))
    .sort((a, b) => b.score - a.score || a.idx - b.idx)
    .slice(0, Math.max(1, limit))
    .map((entry, idx) => ({
      title: entry.article.title,
      url: entry.article.url,
      briefContent: summarize(entry.article.content),
      categoryImportance: `Signal relevance for sourcing, contract, or supplier-risk decisions in this category (${entry.article.sourceName ?? "source"}).`,
      keyMetrics: extractMetrics(entry.article.content),
      imageUrl: entry.article.ogImageUrl,
      imageAlt: entry.article.title,
      sourceName: entry.article.sourceName,
      publishedAt: entry.article.publishedAt,
      sourceIndex: idx + 1,
      sourceId: buildSourceId(entry.article.url)
    }));
}

function summarize(content?: string): string {
  const sentences = pickKeySentences(content, 2);
  if (sentences.length === 0) return "Coverage signal captured for this run window.";
  return sentences.join(" ").slice(0, 420);
}

function extractMetrics(content?: string): string[] {
  const matches = (content ?? "").match(/\b\d[\d.,%$-]*\b/g) ?? [];
  return Array.from(new Set(matches)).slice(0, 3);
}

function toIssueList(error: unknown): string[] {
  try {
    const parsed = JSON.parse((error as Error).message);
    if (Array.isArray(parsed)) return parsed.map((item) => String(item));
  } catch {
    // Fall back to the plain error message below.
  }
  return [(error as Error).message || "unknown_parse_error"];
}

function isReasoningModel(model?: string): boolean {
  if (!model) return false;
  const normalized = model.toLowerCase();
  return normalized.startsWith("gpt-5") || normalized.startsWith("o1") || normalized.startsWith("o3") || normalized.startsWith("o4");
}

function toPreviousBriefContext(previousBrief?: BriefPost | null): Parameters<typeof buildPrompt>[0]["previousBrief"] {
  if (!previousBrief) return undefined;
  return {
    publishedAt: previousBrief.publishedAt,
    title: previousBrief.title,
    highlights: previousBrief.highlights,
    procurementActions: previousBrief.procurementActions,
    watchlist: previousBrief.watchlist,
    selectedArticles: (previousBrief.selectedArticles ?? []).map((article) => ({
      title: article.title,
      url: article.url,
      keyMetrics: article.keyMetrics
    }))
  };
}

async function callLLMEnriched(
  params: GenerateBriefV3Input & { selectedInputs: ArticleInput[] }
): Promise<BriefOutput | null> {
  const model = params.config?.model ?? process.env.OPENAI_MODEL;
  const client = params.config?.openaiClient ?? (process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null);
  if (!model || !client || params.config?.allowLlm === false || params.selectedInputs.length === 0) {
    return null;
  }

  let repairIssues: string[] | undefined;
  let previousJson: string | undefined;
  const requiredCount = Math.min(requiredArticleCount(params.agent), Math.max(1, params.selectedInputs.length));

  for (let attempt = 0; attempt < 3; attempt += 1) {
    let raw = "{}";
    const prompt = buildPrompt({
      agent: { ...params.agent, articlesPerRun: requiredCount },
      region: params.region,
      runWindow: params.runWindow,
      articles: params.selectedInputs,
      indices: params.indices,
      repairIssues,
      previousJson,
      previousBrief: toPreviousBriefContext(params.previousBrief)
    });
    try {
      console.log(JSON.stringify({ level: "info", event: "brief_v3_prompt", model: model ?? null, prompt }));
      const response = await client.chat.completions.create({
        model,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        ...(isReasoningModel(model)
          ? { max_completion_tokens: 3600 }
          : { temperature: 0.2, max_tokens: 3600 })
      });
      raw = response.choices?.[0]?.message?.content ?? "{}";
      console.log(JSON.stringify({ level: "info", event: "brief_v3_llm_raw", model, raw }));
      return parsePromptOutput(raw, requiredCount);
    } catch (error) {
      repairIssues = toIssueList(error);
      previousJson = raw;
      await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
    }
  }

  return null;
}

function assembleBriefPost(
  params: GenerateBriefV3Input & {
    selected: SelectedArticle[];
    selectedInputs: ArticleInput[];
    enriched: BriefOutput;
  }
): BriefPost {
  const selectedArticles = mapEnrichedSelectedArticles(params.selectedInputs, params.enriched, params.agent.label);
  const heroSelectionIndex = params.enriched.heroSelection?.articleIndex;
  const hero = selectedArticles.find((article) => article.sourceIndex === heroSelectionIndex)?.imageUrl ??
    selectedArticles.find((article) => article.imageUrl)?.imageUrl;
  const title = normalizeHeadline(params.enriched.title, params.agent.label, selectedArticles[0]?.title);
  const topStories = buildTopStories(selectedArticles);
  const marketIndicators = buildMarketIndicators(params.indices, params.enriched.marketIndicators, selectedArticles, params.agent.label);
  const sources = buildSources(selectedArticles, marketIndicators);
  const sourceIdByIndex = new Map(selectedArticles.map((article) => [article.sourceIndex ?? 0, article.sourceId ?? buildSourceId(article.url)]));
  const report = buildReport(params.enriched, selectedArticles, sourceIdByIndex);
  const deltaSinceLastRun = deriveDeltaSinceLastRun({
    currentDelta: params.enriched.deltaSinceLastRun,
    topStories,
    previousBrief: params.previousBrief
  });
  const summary = buildExecutiveSummary(params.enriched, report);
  const decisionSummary = buildDecisionSummary(params.enriched, report, sourceIdByIndex);
  const highlights = buildHighlights(params.enriched, report);
  const procurementActions = buildProcurementActions(params.enriched, report);
  const watchlist = buildWatchlist(params.enriched, report);
  const bodyMarkdown = renderBriefMarkdown({
    title,
    summary,
    regionLabel: params.region === "au" ? "Australia (Perth)" : "Americas (Houston)",
    portfolioLabel: params.agent.label,
    runWindow: params.runWindow,
    publishedAtISO: params.nowIso,
    selectedArticles,
    marketIndicators,
    highlights,
    procurementActions,
    watchlist,
    deltaSinceLastRun,
    region: params.region
  });

  return {
    postId: `brief-${params.runIdentity.runId}`,
    runKey: "",
    briefDay: params.runIdentity.briefDay,
    title,
    region: params.region,
    portfolio: params.agent.portfolio,
    runWindow: params.runWindow,
    agentId: params.agent.id,
    status: "published",
    generationStatus: "published",
    version: "v2",
    publishedAt: params.nowIso,
    summary,
    bodyMarkdown,
    selectedArticles,
    sources,
    topStories,
    highlights,
    procurementActions,
    watchlist,
    marketIndicators,
    decisionSummary,
    cmSnapshot: params.enriched.cmSnapshot,
    vpSnapshot: params.enriched.vpSnapshot,
    heroImage: { url: hero ?? makeCategoryPlaceholderDataUrl(params.agent.label), alt: selectedArticles[0]?.title ?? params.agent.label, sourceArticleIndex: heroSelectionIndex ?? 1 },
    heroImageUrl: hero ?? makeCategoryPlaceholderDataUrl(params.agent.label),
    heroImageAlt: selectedArticles[0]?.title ?? params.agent.label,
    heroImageSourceUrl: selectedArticles.find((article) => article.sourceIndex === (heroSelectionIndex ?? 1))?.url ?? selectedArticles[0]?.url,
    newsStatus: selectedArticles.length >= 2 ? "ok" : "thin-category",
    deltaSinceLastRun,
    report,
    qualityReport: { issues: [], decision: "publish" }
  };
}

function buildSources(selected: SelectedArticle[], marketIndicators: BriefMarketIndicator[]): BriefSource[] {
  const entries: BriefSource[] = [
    ...selected.map((article) => ({
      sourceId: article.sourceId ?? buildSourceId(article.url),
      url: article.url,
      title: article.title,
      publishedAt: article.publishedAt
    })),
    ...marketIndicators.map((indicator) => ({
      sourceId: indicator.sourceId ?? buildSourceId(indicator.url),
      url: indicator.url,
      title: indicator.label
    }))
  ];
  return dedupeSources(entries);
}

function normalizeHeadline(title: string | undefined, categoryLabel: string, fallbackTitle?: string): string {
  const cleaned = (title ?? "").replace(/\s+/g, " ").trim();
  if (cleaned.length >= 8 && !/daily brief/i.test(cleaned)) return cleaned;
  if (fallbackTitle) {
    const words = fallbackTitle.split(/\s+/).slice(0, 10).join(" ");
    return `${words} reshape ${categoryLabel} sourcing priorities`.trim();
  }
  return `${categoryLabel} sourcing pressures reshape cost, supply, and contract decisions`;
}

function normalizeText(value?: string): string {
  return stripEvidenceTag((value ?? "").replace(/\s+/g, " ").trim());
}

function splitIntoSentences(text?: string): string[] {
  const normalized = normalizeText(text);
  if (!normalized) return [];
  return (normalized.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [])
    .map((sentence) => sentence.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function pickKeySentences(content?: string, limit = 2): string[] {
  const sentences = splitIntoSentences(content);
  if (sentences.length === 0) return [];
  const score = (sentence: string): number => {
    let points = 0;
    if (/\d|%|\$|€|£|¥|contract|award|capacity|price|rate|lead time|supplier|bid|tender|policy|tariff|outage/i.test(sentence)) points += 3;
    if (sentence.length > 80) points += 1;
    return points;
  };
  return [...sentences]
    .sort((a, b) => score(b) - score(a))
    .slice(0, limit);
}

function dominantTheme(text: string): Theme {
  if (/\b(price|cost|inflation|dayrate|premium|benchmark|index|margin|savings|steel|oil)\b/i.test(text)) return "cost";
  if (/\b(capacity|shortage|delay|supply|lead time|slot|backlog|outage|availability|vessel|rig)\b/i.test(text)) return "supply";
  if (/\b(contract|tender|award|framework|msa|rfq|rfp|renewal|agreement|bid|commercial)\b/i.test(text)) return "commercial";
  if (/\b(tariff|sanction|regulation|compliance|law|permit|policy|mandate|ban)\b/i.test(text)) return "regulatory";
  if (/\b(schedule|project|delivery|commissioning|installation|timeline|window)\b/i.test(text)) return "schedule";
  return "general";
}

function themeLabel(theme: Theme): string {
  switch (theme) {
    case "cost":
      return "cost pressure";
    case "supply":
      return "supplier capacity";
    case "commercial":
      return "commercial leverage";
    case "regulatory":
      return "policy exposure";
    case "schedule":
      return "schedule risk";
    default:
      return "market direction";
  }
}

function themeType(theme: Theme): VpSignalType {
  switch (theme) {
    case "cost":
      return "cost";
    case "supply":
      return "supply";
    case "commercial":
      return "commercial";
    case "regulatory":
      return "regulatory";
    case "schedule":
      return "schedule";
    default:
      return "supplier";
  }
}

function themeHorizon(theme: Theme): VpHorizon {
  switch (theme) {
    case "supply":
    case "regulatory":
      return "0-30d";
    case "cost":
    case "commercial":
      return "30-180d";
    default:
      return "180d+";
  }
}

function themeConfidence(article: ArticleInput): VpConfidence {
  return extractMetrics(article.content).length >= 2 ? "high" : "medium";
}

function frameworkForAgent(agent: AgentConfig): AgentFramework {
  return getAgentFramework(agent.id || agent.portfolio);
}

function pickFrameworkSupplier(article: ArticleInput, framework: AgentFramework, idx = 0): string {
  const titleAndContent = `${article.title} ${article.content ?? ""}`;
  const matched = framework.keySuppliers.find((supplier) => new RegExp(`\\b${supplier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(titleAndContent));
  if (matched) return matched;
  if (framework.keySuppliers.length === 0) {
    return article.sourceName ? `${article.sourceName} counterparties` : "priority suppliers";
  }
  return framework.keySuppliers[idx % framework.keySuppliers.length];
}

function pickFrameworkValue(values: string[], fallback: string, idx = 0): string {
  if (values.length === 0) return fallback;
  return values[idx % values.length];
}

function buildSupplierSignal(article: ArticleInput, framework: AgentFramework, idx = 0): string {
  return pickKeySentences(article.content, 1)[0] ?? `${shortSubject(article.title)} is changing supplier posture across the category.`;
}

function buildCategoryImplication(article: ArticleInput, categoryLabel: string, framework?: AgentFramework, idx = 0): string {
  const theme = dominantTheme(`${article.title} ${article.content ?? ""}`);
  const metrics = extractMetrics(article.content);
  const metricNote = metrics.length > 0 ? `with ${metrics.join(", ")} as the clearest commercial anchors` : "even without clean benchmark data";
  const supplierBehavior = framework ? pickFrameworkValue(framework.dailyCMLens.supplierBehavior, "supplier posture is shifting", idx) : "supplier posture is shifting";
  const contractingImplication = framework ? pickFrameworkValue(framework.dailyCMLens.contractingImplications, "contract flexibility matters", idx) : "contract flexibility matters";
  switch (theme) {
    case "cost":
      return `This matters for ${categoryLabel} because fresh price movement and input-cost detail should reset bid assumptions, ${contractingImplication.toLowerCase()}, and negotiation guardrails ${metricNote}; expect ${supplierBehavior.toLowerCase()}.`;
    case "supply":
      return `This matters for ${categoryLabel} because capacity and lead-time signals can move supplier prioritization, award timing, and contingency lanes ${metricNote}; buyers should plan for ${supplierBehavior.toLowerCase()}.`;
    case "commercial":
      return `This matters for ${categoryLabel} because contracting activity changes leverage, market appetite, and which clauses buyers can credibly trade ${metricNote}; ${contractingImplication} is now more valuable.`;
    case "regulatory":
      return `This matters for ${categoryLabel} because compliance and policy shifts can alter supplier eligibility, import cost, and pass-through exposure ${metricNote}; contracts need room for ${contractingImplication.toLowerCase()}.`;
    case "schedule":
      return `This matters for ${categoryLabel} because timeline movement can quickly cascade into expediting costs, vessel or crew conflicts, and change-order pressure ${metricNote}; expect suppliers to test ${contractingImplication.toLowerCase()}.`;
    default:
      return `This matters for ${categoryLabel} because the signal changes the near-term supplier conversation, especially around price discipline, optionality, and execution readiness.`;
  }
}

function buildHeuristicStoryBrief(article: ArticleInput, categoryLabel: string, framework?: AgentFramework, idx = 0): string {
  const facts = pickKeySentences(article.content, 2).join(" ");
  const implication = buildCategoryImplication(article, categoryLabel, framework, idx);
  return [facts || article.title, implication].filter(Boolean).join(" ");
}

function shortSubject(title: string): string {
  const cleaned = title.replace(/[^a-z0-9\s/&-]/gi, " ").replace(/\s+/g, " ").trim();
  return cleaned.split(" ").slice(0, 6).join(" ");
}

function buildHeuristicHighlights(selectedInputs: ArticleInput[], categoryLabel: string, framework: AgentFramework): string[] {
  return selectedInputs.slice(0, 5).map((article, idx) => {
    const theme = dominantTheme(`${article.title} ${article.content ?? ""}`);
    const fact = pickKeySentences(article.content, 1)[0] ?? article.title;
    const supplier = pickFrameworkSupplier(article, framework, idx);
    return `${idx === 0 ? "Lead move:" : "Signal:"} ${fact} That shifts ${categoryLabel} focus toward ${themeLabel(theme)} and changes the ask to ${supplier}.`;
  });
}

function buildHeuristicActions(selectedInputs: ArticleInput[], framework: AgentFramework): string[] {
  const actions = selectedInputs.map((article) => {
    const subject = shortSubject(article.title);
    const supplier = pickFrameworkSupplier(article, framework);
    const costDriver = pickFrameworkValue(framework.dailyCMLens.costDrivers, "current cost drivers");
    const capacityDriver = pickFrameworkValue(framework.dailyCMLens.capacityDrivers, "capacity constraints");
    const contractingImplication = pickFrameworkValue(framework.dailyCMLens.contractingImplications, "contract flexibility");
    switch (dominantTheme(`${article.title} ${article.content ?? ""}`)) {
      case "cost":
        return `Email ${supplier} to reconfirm ${costDriver.toLowerCase()}, keep quote validity short around ${subject}, and push for ${contractingImplication.toLowerCase()} instead of open-ended surcharge language.`;
      case "supply":
        return `Schedule a supplier call with ${supplier} to validate ${capacityDriver.toLowerCase()}, secure fallback slots around ${subject}, and trade extension options for committed capacity if needed.`;
      case "commercial":
        return `Review renewals with ${supplier} tied to ${subject} and reopen the clause set for minimum-volume trades, extension options, and tighter change-control wording.`;
      case "regulatory":
        return `Ask ${supplier} for a written position on ${subject} and prepare compliance pass-through, substitution, and termination language before the next commitment is approved.`;
      case "schedule":
        return `Stress-test delivery plans with ${supplier} around ${subject}, confirm alternates, and tighten LD or expediting triggers before schedule pressure hardens.`;
      default:
        return `Re-rank the supplier conversation with ${supplier} around ${subject} and confirm what commercial flexibility still exists before market leverage deteriorates.`;
    }
  });
  return Array.from(new Set(actions)).slice(0, 6);
}

function buildHeuristicWatchlist(selectedInputs: ArticleInput[], framework: AgentFramework): string[] {
  return selectedInputs.slice(0, 4).map((article) => {
    const subject = shortSubject(article.title);
    const theme = dominantTheme(`${article.title} ${article.content ?? ""}`);
    const supplier = pickFrameworkSupplier(article, framework);
    switch (theme) {
      case "cost":
        return `Watch whether ${supplier} starts using ${subject} as a repricing reference in quotes, escalator asks, or budget resets.`;
      case "supply":
        return `Watch whether ${subject} turns into visible slot scarcity, longer qualification queues, or firmer allocation language from ${supplier}.`;
      case "commercial":
        return `Watch whether ${subject} reduces buyer leverage in renewals and pushes ${supplier} toward firmer commercial positions.`;
      case "regulatory":
        return `Watch whether ${subject} introduces new compliance checks, import friction, or pass-through claims from ${supplier}.`;
      case "schedule":
        return `Watch whether ${subject} creates knock-on schedule compression and expediting requests across active packages with ${supplier}.`;
      default:
        return `Watch whether ${subject} develops into a confirmed sourcing constraint rather than an isolated headline.`;
    }
  });
}

function buildHeuristicMarketIndicators(indices: MarketIndex[], categoryLabel: string): Array<{ indexId: string; note: string }> {
  return indices.slice(0, 4).map((index) => ({
    indexId: index.id,
    note: `${index.label} should be used as a negotiation boundary for ${categoryLabel} pricing, supplier challenge sessions, and contingency budgeting this cycle.`
  }));
}

function clampScore(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function buildHeuristicVpSnapshot(
  selectedInputs: ArticleInput[],
  actions: string[],
  categoryLabel: string,
  framework: AgentFramework
): BriefOutput["vpSnapshot"] {
  const themes = selectedInputs.map((article) => dominantTheme(`${article.title} ${article.content ?? ""}`));
  const costCount = themes.filter((theme) => theme === "cost").length;
  const supplyCount = themes.filter((theme) => theme === "supply").length;
  const commercialCount = themes.filter((theme) => theme === "commercial").length;
  const regulatoryCount = themes.filter((theme) => theme === "regulatory").length;
  const scheduleCount = themes.filter((theme) => theme === "schedule").length;

  const costPressure = clampScore(35 + costCount * 18 + commercialCount * 6, 20, 92);
  const supplyRisk = clampScore(30 + supplyCount * 20 + scheduleCount * 8, 20, 92);
  const scheduleRisk = clampScore(22 + scheduleCount * 18 + supplyCount * 8, 15, 88);
  const complianceRisk = clampScore(15 + regulatoryCount * 24, 10, 85);
  const overall = clampScore(88 - Math.round((costPressure + supplyRisk + scheduleRisk + complianceRisk) / 7), 38, 86);

  const topSignals = selectedInputs.slice(0, 4).map((article, idx) => ({
    title: `Signal ${idx + 1}: ${shortSubject(article.title)}`,
    type: themeType(dominantTheme(`${article.title} ${article.content ?? ""}`)),
    horizon: themeHorizon(dominantTheme(`${article.title} ${article.content ?? ""}`)),
    confidence: themeConfidence(article),
    impact: buildCategoryImplication(article, categoryLabel, framework, idx),
    evidenceArticleIndex: idx + 1
  }));

  const recommendedActions = actions.slice(0, 4).map((action, idx) => ({
    action,
    ownerRole: idx % 2 === 0 ? "Category Manager" : "Contracts",
    dueInDays: [5, 10, 21, 35][idx] ?? 14,
    expectedImpact: `This should improve negotiating posture and reduce surprise exposure against the ${themeLabel(dominantTheme(action))} now visible in the brief.`,
    confidence: "medium" as const,
    evidenceArticleIndex: Math.min(idx + 1, selectedInputs.length)
  }));

  const riskRegister = selectedInputs.slice(0, 4).map((article, idx) => ({
    risk: `${shortSubject(article.title)} creates ${themeLabel(dominantTheme(`${article.title} ${article.content ?? ""}`))}.`,
    probability: themeConfidence(article),
    impact: dominantTheme(`${article.title} ${article.content ?? ""}`) === "regulatory" ? "high" as const : "medium" as const,
    mitigation: actions[idx] ?? `Maintain an alternate supplier and contracting path around ${shortSubject(article.title)}.`,
    trigger: pickKeySentences(article.content, 1)[0] ?? article.title,
    horizon: themeHorizon(dominantTheme(`${article.title} ${article.content ?? ""}`)),
    evidenceArticleIndex: idx + 1
  }));

  return {
    health: {
      overall,
      costPressure,
      supplyRisk,
      scheduleRisk,
      complianceRisk,
      narrative: `The biggest executive exposure for ${categoryLabel} is ${themeLabel(themes[0] ?? "general")} because today's lead stories point to faster-moving supplier and commercial decisions than the current brief cadence alone would suggest.`
    },
    topSignals,
    recommendedActions,
    riskRegister
  };
}

function buildHeuristicCmSnapshot(
  selectedInputs: ArticleInput[],
  actions: string[],
  categoryLabel: string,
  framework: AgentFramework
): BriefOutput["cmSnapshot"] {
  const todayPriorities = actions.slice(0, 4).map((action, idx) => ({
    title: action,
    why: buildCategoryImplication(selectedInputs[idx] ?? selectedInputs[0], categoryLabel, framework, idx),
    dueInDays: [3, 7, 10, 14][idx] ?? 7,
    confidence: themeConfidence(selectedInputs[idx] ?? selectedInputs[0]),
    evidenceArticleIndex: Math.min(idx + 1, selectedInputs.length)
  }));

  const supplierRadar = selectedInputs.slice(0, 4).map((article, idx) => ({
    supplier: pickFrameworkSupplier(article, framework, idx),
    signal: buildSupplierSignal(article, framework, idx),
    implication: buildCategoryImplication(article, categoryLabel, framework, idx),
    nextStep: actions[idx] ?? `Schedule a supplier checkpoint around ${shortSubject(article.title)}.`,
    confidence: themeConfidence(article),
    evidenceArticleIndex: idx + 1
  }));

  const negotiationLevers = selectedInputs.slice(0, 4).map((article, idx) => {
    const theme = dominantTheme(`${article.title} ${article.content ?? ""}`);
    switch (theme) {
      case "cost":
        return {
          lever: `Use ${pickFrameworkValue(framework.dailyCMLens.contractingImplications, "caps/collars on index-linked pricing", idx)}`,
          whenToUse: `Use when ${pickFrameworkSupplier(article, framework, idx)} cites ${shortSubject(article.title)} to justify immediate repricing or wider surcharge language.`,
          expectedOutcome: "Limit upside cost exposure while preserving awardability for time-sensitive work and keeping the supplier commercially engaged.",
          confidence: themeConfidence(article),
          evidenceArticleIndex: idx + 1
        };
      case "supply":
        return {
          lever: "Trade extension options, standby retainer, or minimum-volume commits for committed capacity",
          whenToUse: `Use when ${shortSubject(article.title)} points to tightening slots or scarce availability from ${pickFrameworkSupplier(article, framework, idx)}.`,
          expectedOutcome: "Protect delivery certainty without paying full scarcity premiums upfront while keeping fallback capacity live.",
          confidence: themeConfidence(article),
          evidenceArticleIndex: idx + 1
        };
      case "commercial":
        return {
          lever: `Use ${pickFrameworkValue(framework.dailyCMLens.contractingImplications, "minimum-volume and substitution clauses", idx)}`,
          whenToUse: `Use when ${shortSubject(article.title)} shifts leverage toward ${pickFrameworkSupplier(article, framework, idx)} during renewal or award cycles.`,
          expectedOutcome: "Preserve flexibility while still creating enough demand visibility to win concessions and protect service outcomes.",
          confidence: themeConfidence(article),
          evidenceArticleIndex: idx + 1
        };
      case "regulatory":
        return {
          lever: "Insert compliance pass-through and exit language",
          whenToUse: `Use when ${shortSubject(article.title)} introduces policy or regulatory uncertainty into supplier delivery.`,
          expectedOutcome: "Reduce the chance that buyers absorb avoidable compliance cost or eligibility shocks.",
          confidence: themeConfidence(article),
          evidenceArticleIndex: idx + 1
        };
      default:
        return {
          lever: "Keep dual-sourcing and standby options live",
          whenToUse: `Use when ${shortSubject(article.title)} increases uncertainty but the evidence is still early-stage.`,
          expectedOutcome: "Maintain commercial optionality until supplier behavior is confirmed in quotes or execution plans.",
          confidence: themeConfidence(article),
          evidenceArticleIndex: idx + 1
        };
    }
  });

  return {
    todayPriorities,
    supplierRadar,
    negotiationLevers,
    intelGaps: [
      `Need direct confirmation from ${framework.keySuppliers.slice(0, 2).join(" / ") || "priority suppliers"} on whether today's signals are already flowing into fresh quote assumptions.`,
      `Need clearer visibility on ${pickFrameworkValue(framework.dailyCMLens.capacityDrivers, "real spare capacity", 1).toLowerCase()} versus headline-only announcements.`
    ],
    talkingPoints: [
      `${categoryLabel} conditions are now tactical: the latest signals justify immediate outreach to ${framework.keySuppliers[0] ?? "priority suppliers"} and a clause-by-clause contract refresh.`,
      `Use today's signal mix to challenge ${pickFrameworkValue(framework.dailyCMLens.costDrivers, "price logic").toLowerCase()}, confirm ${pickFrameworkValue(framework.dailyCMLens.capacityDrivers, "capacity").toLowerCase()}, and preserve fallback options before leverage deteriorates.`
    ]
  };
}

function buildHeuristicDecisionSummary(
  selectedInputs: ArticleInput[],
  highlights: string[],
  actions: string[],
  watchlist: string[]
): DecisionSummary {
  const leadTheme = dominantTheme(`${selectedInputs[0]?.title ?? ""} ${selectedInputs[0]?.content ?? ""}`);
  return {
    topMove: actions[0] ?? `Respond quickly to the latest ${themeLabel(leadTheme)} signal before it hardens into supplier behavior.`,
    whatChanged: highlights.slice(0, 3),
    doNext: actions.slice(0, 5),
    watchThisWeek: watchlist.slice(0, 4)
  };
}

function buildFallbackFramework(agentLabel: string): AgentFramework {
  return {
    focusAreas: [agentLabel],
    keySuppliers: [],
    marketDrivers: [],
    procurementConsiderations: [],
    dailyCMLens: {
      costDrivers: ["price logic"],
      capacityDrivers: ["capacity signals"],
      supplierBehavior: ["supplier posture is shifting"],
      contractingImplications: ["contract flexibility matters"],
      complianceTriggers: ["compliance triggers"]
    }
  };
}

function buildHeuristicBriefOutput(
  params: GenerateBriefV3Input & { selectedInputs: ArticleInput[] }
): BriefOutput {
  const framework = frameworkForAgent(params.agent);
  const requiredCount = Math.min(requiredArticleCount(params.agent), Math.max(1, params.selectedInputs.length));
  const selectedInputs = params.selectedInputs.slice(0, requiredCount);
  const selectedArticles = selectedInputs.map((article, idx) => ({
    articleIndex: idx + 1,
    briefContent: buildHeuristicStoryBrief(article, params.agent.label, framework, idx),
    categoryImportance: buildCategoryImplication(article, params.agent.label, framework, idx),
    keyMetrics: extractMetrics(article.content),
    imageAlt: article.title
  }));
  const highlights = buildHeuristicHighlights(selectedInputs, params.agent.label, framework);
  const procurementActions = buildHeuristicActions(selectedInputs, framework);
  const watchlist = buildHeuristicWatchlist(selectedInputs, framework);
  const decisionSummary = buildHeuristicDecisionSummary(selectedInputs, highlights, procurementActions, watchlist);
  const marketIndicators = buildHeuristicMarketIndicators(params.indices, params.agent.label);
  const cmSnapshot = buildHeuristicCmSnapshot(selectedInputs, procurementActions, params.agent.label, framework);
  const vpSnapshot = buildHeuristicVpSnapshot(selectedInputs, procurementActions, params.agent.label, framework);

  return {
    title: normalizeHeadline(undefined, params.agent.label, selectedInputs[0]?.title),
    summary: [
      `The lead signals for ${params.agent.label} are no longer just descriptive; they point to immediate sourcing implications around ${themeLabel(dominantTheme(`${selectedInputs[0]?.title ?? ""} ${selectedInputs[0]?.content ?? ""}`))}.`,
      normalizeText(highlights[0]),
      `The practical read-through is that buyers should tighten supplier challenge, pricing discipline, and contract optionality before the next decision gate.`
    ].filter(Boolean).join(" "),
    highlights,
    procurementActions,
    watchlist,
    deltaSinceLastRun: params.previousBrief ? [`Lead coverage has rotated toward "${selectedInputs[0]?.title ?? params.agent.label}", shifting the brief toward more immediate execution implications.`] : [],
    decisionSummary,
    selectedArticles,
    heroSelection: { articleIndex: 1 },
    marketIndicators,
    cmSnapshot,
    vpSnapshot
  };
}

function mapEnrichedSelectedArticles(
  selectedInputs: ArticleInput[],
  enriched: BriefOutput,
  categoryLabel: string
): SelectedArticle[] {
  const primaryInput = selectedInputs[0];
  if (!primaryInput) return [];
  const fallbackFramework = buildFallbackFramework(categoryLabel);
  const output = enriched.selectedArticles.length > 0 ? enriched.selectedArticles : [{
    articleIndex: 1,
    briefContent: buildHeuristicStoryBrief(primaryInput, categoryLabel, fallbackFramework),
    categoryImportance: buildCategoryImplication(primaryInput, categoryLabel, fallbackFramework)
  }];
  return output
    .map((article) => {
      const source = selectedInputs[article.articleIndex - 1];
      if (!source) return null;
      return {
        title: source.title,
        url: source.url,
        briefContent: normalizeText(article.briefContent) || summarize(source.content),
        categoryImportance: normalizeText(article.categoryImportance) || buildCategoryImplication(source, categoryLabel, fallbackFramework),
        keyMetrics: (article.keyMetrics ?? []).filter(Boolean).slice(0, 6),
        imageUrl: source.ogImageUrl,
        imageAlt: article.imageAlt || source.title,
        sourceName: source.sourceName,
        publishedAt: source.publishedAt,
        sourceIndex: article.articleIndex,
        sourceId: buildSourceId(source.url)
      } satisfies SelectedArticle;
    })
    .filter((article): article is SelectedArticle => Boolean(article));
}

function buildMarketIndicators(
  indices: MarketIndex[],
  rawIndicators: Array<{ indexId: string; note: string }>,
  selectedArticles: SelectedArticle[],
  categoryLabel: string
): BriefMarketIndicator[] {
  const selectedTheme = dominantTheme(
    selectedArticles.map((article) => `${article.title} ${article.categoryImportance ?? ""}`).join(" ")
  );
  const rawById = new Map(rawIndicators.map((indicator) => [indicator.indexId, indicator]));
  return indices.slice(0, 6).map((index) => ({
    id: index.id,
    label: index.label,
    url: index.url,
    note: normalizeText(rawById.get(index.id)?.note) ||
      `${index.label} should be monitored as a live boundary for ${categoryLabel} decisions, especially where ${themeLabel(selectedTheme)} is starting to feed supplier expectations.`,
    sourceId: buildSourceId(index.url)
  }));
}

function mapTextToBullet(
  text: string,
  sourceIdByIndex: Map<number, string>,
  fallbackIndex: number,
  signal: BriefCitedBullet["signal"] = "confirmed"
): BriefCitedBullet {
  const parsed = parseEvidenceTag(text);
  const cleaned = normalizeText(text);
  const sourceIndex = parsed.kind === "source" ? parsed.articleIndex : fallbackIndex;
  const sourceId = sourceIdByIndex.get(sourceIndex);
  return {
    text: cleaned,
    sourceIds: sourceId ? [sourceId] : [],
    signal: parsed.kind === "analysis" ? "early-signal" : signal
  };
}

function mapPriorityToAction(
  priority: NonNullable<CmSnapshot["todayPriorities"]>[number],
  sourceIdByIndex: Map<number, string>
): BriefReportAction {
  return {
    action: normalizeText(priority.title),
    rationale: normalizeText(priority.why) || "Act now because the latest source-backed signal warrants immediate category follow-up.",
    owner: "Category",
    expectedOutcome: `Complete this within ${priority.dueInDays} days to reduce buyer surprise and tighten near-term sourcing control.`,
    sourceIds: sourceIdByIndex.get(priority.evidenceArticleIndex) ? [sourceIdByIndex.get(priority.evidenceArticleIndex)!] : []
  };
}

function mapVpActionToAction(
  action: NonNullable<BriefOutput["vpSnapshot"]>["recommendedActions"][number],
  sourceIdByIndex: Map<number, string>
): BriefReportAction {
  return {
    action: normalizeText(action.action),
    rationale: `Move now because ${normalizeText(action.expectedImpact)}`.slice(0, 240),
    owner: /legal/i.test(action.ownerRole) ? "Legal" : /contract/i.test(action.ownerRole) ? "Contracts" : /logistics|ops|engineering/i.test(action.ownerRole) ? "Ops" : "Category",
    expectedOutcome: normalizeText(action.expectedImpact),
    sourceIds: sourceIdByIndex.get(action.evidenceArticleIndex) ? [sourceIdByIndex.get(action.evidenceArticleIndex)!] : []
  };
}

function dedupeBullets(bullets: BriefCitedBullet[]): BriefCitedBullet[] {
  const seen = new Set<string>();
  return bullets.filter((bullet) => {
    const key = bullet.text.toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedupeReportActions(actions: BriefReportAction[]): BriefReportAction[] {
  const seen = new Set<string>();
  return actions.filter((action) => {
    const key = action.action.toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildImpactGroups(
  enriched: BriefOutput,
  selectedArticles: SelectedArticle[],
  sourceIdByIndex: Map<number, string>
): BriefReport["impactGroups"] {
  const marketCostDrivers = dedupeBullets([
    ...(enriched.highlights ?? [])
      .filter((item) => dominantTheme(item) === "cost")
      .map((item, idx) => mapTextToBullet(item, sourceIdByIndex, idx + 1)),
    ...selectedArticles
      .filter((article) => dominantTheme(`${article.title} ${article.briefContent}`) === "cost")
      .map((article) => ({
        text: article.categoryImportance ?? article.briefContent,
        sourceIds: article.sourceId ? [article.sourceId] : [],
        signal: "confirmed" as const
      }))
  ]);

  const supplyBaseCapacity = dedupeBullets([
    ...((enriched.cmSnapshot?.supplierRadar ?? []).map((item) => ({
      text: normalizeText(item.implication || item.signal),
      sourceIds: sourceIdByIndex.get(item.evidenceArticleIndex) ? [sourceIdByIndex.get(item.evidenceArticleIndex)!] : [],
      signal: item.confidence === "high" ? "confirmed" as const : "early-signal" as const
    }))),
    ...selectedArticles
      .filter((article) => dominantTheme(`${article.title} ${article.briefContent}`) === "supply")
      .map((article) => ({
        text: article.categoryImportance ?? article.briefContent,
        sourceIds: article.sourceId ? [article.sourceId] : [],
        signal: "confirmed" as const
      }))
  ]);

  const contractingCommercialTerms = dedupeBullets([
    ...((enriched.cmSnapshot?.negotiationLevers ?? []).map((item) => ({
      text: `${normalizeText(item.lever)}. ${normalizeText(item.expectedOutcome)}`.trim(),
      sourceIds: sourceIdByIndex.get(item.evidenceArticleIndex) ? [sourceIdByIndex.get(item.evidenceArticleIndex)!] : [],
      signal: item.confidence === "high" ? "confirmed" as const : "early-signal" as const
    }))),
    ...(enriched.highlights ?? [])
      .filter((item) => dominantTheme(item) === "commercial")
      .map((item, idx) => mapTextToBullet(item, sourceIdByIndex, idx + 1))
  ]);

  const riskRegulatoryOperationalConstraints = dedupeBullets([
    ...(enriched.watchlist ?? []).map((item, idx) => mapTextToBullet(item, sourceIdByIndex, Math.min(idx + 1, selectedArticles.length), "early-signal")),
    ...((enriched.vpSnapshot?.riskRegister ?? []).map((risk) => ({
      text: `${normalizeText(risk.risk)} Trigger: ${normalizeText(risk.trigger)}`.trim(),
      sourceIds: risk.evidenceArticleIndex && sourceIdByIndex.get(risk.evidenceArticleIndex) ? [sourceIdByIndex.get(risk.evidenceArticleIndex)!] : [],
      signal: risk.probability === "high" ? "confirmed" as const : "early-signal" as const
    })))
  ]);

  return [
    { label: "Market/Cost drivers", bullets: marketCostDrivers.slice(0, 4) },
    { label: "Supply base & capacity", bullets: supplyBaseCapacity.slice(0, 4) },
    { label: "Contracting & commercial terms", bullets: contractingCommercialTerms.slice(0, 4) },
    { label: "Risk & regulatory / operational constraints", bullets: riskRegulatoryOperationalConstraints.slice(0, 4) }
  ].filter((group) => group.bullets.length > 0);
}

function buildActionGroups(
  enriched: BriefOutput,
  selectedArticles: SelectedArticle[],
  sourceIdByIndex: Map<number, string>
): BriefReport["actionGroups"] {
  const shortTerm = dedupeReportActions([
    ...((enriched.cmSnapshot?.todayPriorities ?? []).slice(0, 3).map((priority) => mapPriorityToAction(priority, sourceIdByIndex))),
    ...(enriched.procurementActions ?? []).slice(0, 2).map((action, idx) => ({
      action: normalizeText(action),
      rationale: `Move now because the latest evidence implies the current supplier posture may be stale by the next sourcing gate.`,
      owner: "Category" as const,
      expectedOutcome: "Updated supplier read-out and tighter immediate negotiating posture.",
      sourceIds: sourceIdByIndex.get(Math.min(idx + 1, selectedArticles.length)) ? [sourceIdByIndex.get(Math.min(idx + 1, selectedArticles.length))!] : []
    }))
  ]);

  const midTerm = dedupeReportActions([
    ...((enriched.vpSnapshot?.recommendedActions ?? []).filter((action) => action.dueInDays <= 30).map((action) => mapVpActionToAction(action, sourceIdByIndex))),
    ...((enriched.cmSnapshot?.negotiationLevers ?? []).slice(0, 2).map((lever) => ({
      action: `Prepare ${normalizeText(lever.lever).toLowerCase()} for the next negotiation cycle.`,
      rationale: `Deploy it because ${normalizeText(lever.whenToUse)}`.slice(0, 240),
      owner: "Contracts" as const,
      expectedOutcome: normalizeText(lever.expectedOutcome),
      sourceIds: sourceIdByIndex.get(lever.evidenceArticleIndex) ? [sourceIdByIndex.get(lever.evidenceArticleIndex)!] : []
    })))
  ]);

  const longTerm = dedupeReportActions([
    ...((enriched.vpSnapshot?.recommendedActions ?? []).filter((action) => action.dueInDays > 30).map((action) => mapVpActionToAction(action, sourceIdByIndex))),
    {
      action: "Use the current signal mix to tighten quarter-ahead sourcing scenarios and supplier optionality plans.",
      rationale: "Prepare now because repeated cross-source signals are pointing to a more fragile commercial environment than a headline-only read suggests.",
      owner: "Category" as const,
      expectedOutcome: "A cleaner quarter-ahead demand, budget, and fallback-supplier plan.",
      sourceIds: selectedArticles[0]?.sourceId ? [selectedArticles[0].sourceId] : []
    }
  ]);

  return [
    { horizon: "Next 72 hours", actions: shortTerm.slice(0, 4) },
    { horizon: "Next 2-4 weeks", actions: midTerm.slice(0, 4) },
    { horizon: "Next quarter", actions: longTerm.slice(0, 4) }
  ].filter((group) => group.actions.length > 0);
}

function buildSummaryBullets(
  enriched: BriefOutput,
  sourceIdByIndex: Map<number, string>
): BriefCitedBullet[] {
  const sentences = splitIntoSentences(enriched.summary);
  const candidates = [
    enriched.decisionSummary?.topMove,
    ...sentences,
    ...(enriched.decisionSummary?.whatChanged ?? []),
    ...(enriched.highlights ?? [])
  ].filter(Boolean) as string[];
  return dedupeBullets(candidates.slice(0, 5).map((text, idx) => mapTextToBullet(text, sourceIdByIndex, idx + 1)));
}

function buildReport(
  enriched: BriefOutput,
  selectedArticles: SelectedArticle[],
  sourceIdByIndex: Map<number, string>
): BriefReport {
  return {
    summaryBullets: buildSummaryBullets(enriched, sourceIdByIndex),
    impactGroups: buildImpactGroups(enriched, selectedArticles, sourceIdByIndex),
    actionGroups: buildActionGroups(enriched, selectedArticles, sourceIdByIndex)
  };
}

function buildExecutiveSummary(enriched: BriefOutput, report: BriefReport): string {
  const explicit = normalizeText(enriched.summary);
  if (explicit) return explicit;
  return report.summaryBullets.map((bullet) => bullet.text).join(" ").slice(0, 520);
}

function buildHighlights(enriched: BriefOutput, report: BriefReport): string[] {
  const items = (enriched.highlights ?? []).map(normalizeText).filter(Boolean);
  if (items.length > 0) return items.slice(0, 8);
  return report.impactGroups.flatMap((group) => group.bullets.map((bullet) => `${group.label}: ${bullet.text}`)).slice(0, 8);
}

function buildProcurementActions(enriched: BriefOutput, report: BriefReport): string[] {
  const explicit = (enriched.procurementActions ?? []).map(normalizeText).filter(Boolean);
  if (explicit.length > 0) return explicit.slice(0, 8);
  return report.actionGroups.flatMap((group) => group.actions.map((action) => action.action)).slice(0, 8);
}

function buildWatchlist(enriched: BriefOutput, report: BriefReport): string[] {
  const explicit = (enriched.watchlist ?? []).map(normalizeText).filter(Boolean);
  if (explicit.length > 0) return explicit.slice(0, 8);
  const riskGroup = report.impactGroups.find((group) => /risk|regulatory/i.test(group.label));
  return (riskGroup?.bullets ?? []).map((bullet) => bullet.text).slice(0, 6);
}

function buildDecisionSummary(
  enriched: BriefOutput,
  report: BriefReport
): DecisionSummary {
  if (enriched.decisionSummary) {
    return {
      topMove: normalizeText(enriched.decisionSummary.topMove),
      whatChanged: (enriched.decisionSummary.whatChanged ?? []).map(normalizeText).filter(Boolean).slice(0, 4),
      doNext: (enriched.decisionSummary.doNext ?? []).map(normalizeText).filter(Boolean).slice(0, 5),
      watchThisWeek: (enriched.decisionSummary.watchThisWeek ?? []).map(normalizeText).filter(Boolean).slice(0, 4)
    };
  }
  return {
    topMove: report.summaryBullets[0]?.text ?? "Monitor current supplier and market conditions closely.",
    whatChanged: buildHighlights(enriched, report).slice(0, 3),
    doNext: buildProcurementActions(enriched, report).slice(0, 4),
    watchThisWeek: buildWatchlist(enriched, report).slice(0, 4)
  };
}

function validateHardAndRepair(brief: BriefPost, previousBrief?: BriefPost | null): BriefPost {
  const repaired = { ...brief };
  if (!repaired.topStories || repaired.topStories.length === 0) {
    const firstSource = repaired.sources?.[0];
    const firstSourceUrl = typeof firstSource === "string" ? firstSource : firstSource?.url;
    repaired.topStories = [{ sourceArticleIndex: 1, title: repaired.selectedArticles?.[0]?.title ?? repaired.title, url: repaired.selectedArticles?.[0]?.url ?? firstSourceUrl ?? "data:text/plain,source-unavailable" }];
  }
  if (!repaired.heroImage?.url || (!repaired.heroImage.url.startsWith("https://") && !repaired.heroImage.url.startsWith("data:image/"))) {
    repaired.heroImage = { url: makeCategoryPlaceholderDataUrl(repaired.portfolio), alt: repaired.title, sourceArticleIndex: 1 };
    repaired.heroImageUrl = repaired.heroImage.url;
  }
  if (previousBrief && (!repaired.deltaSinceLastRun || repaired.deltaSinceLastRun.length === 0)) {
    repaired.deltaSinceLastRun = [`Coverage focus updated since ${previousBrief.publishedAt.slice(0, 10)} with refreshed source set.`];
  }

  const v2 = validateBriefV2Record(repaired, { hasPreviousBrief: Boolean(previousBrief) });
  if (!v2.ok) {
    repaired.qualityReport = { issues: [...(repaired.qualityReport?.issues ?? []), ...v2.issues], decision: "publish" };
  }
  return repaired;
}

function validateSoft(brief: BriefPost, selected: SelectedArticle[]): BriefPost {
  const knownSourceIds = new Set((brief.sources ?? []).map((source) => (typeof source === "string" ? buildSourceId(source) : source.sourceId)));
  const warnings: string[] = [];
  const cleanReport = brief.report
    ? {
        ...brief.report,
        summaryBullets: brief.report.summaryBullets.filter((bullet) => {
          const valid = bullet.sourceIds.filter((sourceId) => knownSourceIds.has(sourceId));
          if (valid.length === 0) {
            warnings.push(`Dropped uncited summary bullet: ${bullet.text.slice(0, 80)}`);
            return false;
          }
          bullet.sourceIds = valid;
          return true;
        }),
        impactGroups: brief.report.impactGroups.map((group) => ({
          ...group,
          bullets: group.bullets.filter((bullet) => {
            const valid = bullet.sourceIds.filter((sourceId) => knownSourceIds.has(sourceId));
            if (valid.length === 0) return false;
            bullet.sourceIds = valid;
            return true;
          })
        })),
        actionGroups: brief.report.actionGroups.map((group) => ({
          ...group,
          actions: group.actions.filter((action) => {
            const valid = action.sourceIds.filter((sourceId) => knownSourceIds.has(sourceId));
            if (valid.length === 0) return false;
            action.sourceIds = valid;
            return true;
          })
        }))
      }
    : undefined;

  const withReport = {
    ...brief,
    report: cleanReport,
    qualityReport: { issues: [...(brief.qualityReport?.issues ?? []), ...warnings], decision: "publish" as const }
  };

  const allowedUrls = new Set([...(selected.map((article) => article.url)), ...((brief.sources ?? []).map((source) => (typeof source === "string" ? source : source.url)))]);
  const bodyUrls = Array.from(withReport.bodyMarkdown.matchAll(/\((https?:\/\/[^)]+)\)/g)).map((m) => m[1]);
  if (bodyUrls.some((url) => !allowedUrls.has(url))) {
    console.warn(JSON.stringify({ level: "warn", event: "brief_v3_markdown_repair", bodyUrls, allowedUrls: Array.from(allowedUrls) }));
    withReport.bodyMarkdown = renderBriefMarkdown({
      title: withReport.title,
      summary: withReport.summary ?? "",
      regionLabel: withReport.region === "au" ? "Australia (Perth)" : "Americas (Houston)",
      portfolioLabel: withReport.portfolio,
      runWindow: withReport.runWindow,
      publishedAtISO: withReport.publishedAt,
      selectedArticles: selected,
      marketIndicators: withReport.marketIndicators ?? [],
      highlights: withReport.highlights ?? [],
      procurementActions: withReport.procurementActions ?? [],
      watchlist: withReport.watchlist ?? [],
      deltaSinceLastRun: withReport.deltaSinceLastRun ?? [],
      region: withReport.region
    });
    withReport.qualityReport.issues.push("Re-rendered markdown to remove untrusted URLs.");
  }

  return withReport;
}
