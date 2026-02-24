import { AgentConfig, BriefPost, BriefReport, BriefSource, BriefV2NewsStatus, MarketIndex, RegionSlug, RunWindow, SelectedArticle, buildSourceId, getBriefDayKey, makeCategoryPlaceholderDataUrl, validateBriefV2Record } from "@proof/shared";
import { OpenAI } from "openai";
import type { ArticleInput } from "../llm/openai.js";

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
  const prompt = buildStructuredPrompt({ ...input, selected });
  const llmResult = await callLLMStructured(prompt, input.config);
  const assembled = assembleBriefPost({ ...input, selected, llmResult });
  const repaired = validateHardAndRepair(assembled, input.previousBrief);
  return validateSoft(repaired, selected);
}

type LlmStructured = {
  title?: string;
  summaryBullets: string[];
  impactBullets: string[];
  actions: Array<{ action: string; rationale: string; owner: "Category" | "Contracts" | "Legal" | "Ops"; expectedOutcome: string }>;
  deltaBullets: string[];
  raw?: string;
};

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
  const clean = (content ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return "Coverage signal captured for this run window.";
  return clean.slice(0, 280);
}

function extractMetrics(content?: string): string[] {
  const matches = (content ?? "").match(/\b\d[\d.,%$-]*\b/g) ?? [];
  return Array.from(new Set(matches)).slice(0, 3);
}

function buildStructuredPrompt(params: GenerateBriefV3Input & { selected: SelectedArticle[] }): string {
  const selected = params.selected.map((article, idx) => ({ idx: idx + 1, title: article.title, url: article.url, sourceName: article.sourceName, publishedAt: article.publishedAt, content: article.briefContent }));
  const previous = params.previousBrief ? { title: params.previousBrief.title, deltaSinceLastRun: params.previousBrief.deltaSinceLastRun ?? [], publishedAt: params.previousBrief.publishedAt } : undefined;
  const schema = { title: "string", summaryBullets: ["string"], impactBullets: ["string"], actions: [{ action: "string", rationale: "string", owner: "Category|Contracts|Legal|Ops", expectedOutcome: "string" }], deltaBullets: ["string"] };
  return JSON.stringify({
    instruction: "RETURN JSON ONLY. Use only provided article facts. No URLs in text. No uncited claims.",
    schema,
    selected,
    previous,
    nowIso: params.nowIso,
    portfolio: params.agent.portfolio,
    region: params.region
  });
}

async function callLLMStructured(prompt: string, config?: GenerateBriefV3Input["config"]): Promise<LlmStructured> {
  const model = config?.model ?? process.env.OPENAI_MODEL;
  console.log(JSON.stringify({ level: "info", event: "brief_v3_prompt", model: model ?? null, prompt }));
  const client = config?.openaiClient ?? (process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null);
  if (!model || !client || config?.allowLlm === false) {
    return { summaryBullets: [], impactBullets: [], actions: [], deltaBullets: [] };
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await client.chat.completions.create({
        model,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 1200
      });
      const raw = response.choices?.[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(raw) as LlmStructured;
      console.log(JSON.stringify({ level: "info", event: "brief_v3_llm_raw", model, raw }));
      return {
        title: typeof parsed.title === "string" ? parsed.title : undefined,
        summaryBullets: Array.isArray(parsed.summaryBullets) ? parsed.summaryBullets.filter(Boolean) : [],
        impactBullets: Array.isArray(parsed.impactBullets) ? parsed.impactBullets.filter(Boolean) : [],
        actions: Array.isArray(parsed.actions) ? parsed.actions.filter((a) => a?.action && a?.rationale && a?.owner && a?.expectedOutcome) : [],
        deltaBullets: Array.isArray(parsed.deltaBullets) ? parsed.deltaBullets.filter(Boolean) : [],
        raw
      };
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
    }
  }
  return { summaryBullets: [], impactBullets: [], actions: [], deltaBullets: [] };
}

function assembleBriefPost(params: GenerateBriefV3Input & { selected: SelectedArticle[]; llmResult: LlmStructured }): BriefPost {
  const sources = buildSources(params.selected, params.indices);
  const sourceIds = params.selected.map((article) => article.sourceId!).filter(Boolean);
  const report: BriefReport = {
    summaryBullets: (params.llmResult.summaryBullets.length ? params.llmResult.summaryBullets : params.selected.map((s) => `Update: ${s.title}`).slice(0, 3)).map((text, idx) => ({ text, sourceIds: [sourceIds[idx % sourceIds.length]].filter(Boolean), signal: "confirmed" })),
    impactGroups: [{ label: "Sourcing impact", bullets: (params.llmResult.impactBullets.length ? params.llmResult.impactBullets : params.selected.map((s) => `Supplier and contract implications tied to: ${s.title}`)).slice(0, 3).map((text, idx) => ({ text, sourceIds: [sourceIds[idx % sourceIds.length]].filter(Boolean), signal: "confirmed" })) }],
    actionGroups: [{ horizon: "Next 72 hours", actions: (params.llmResult.actions.length ? params.llmResult.actions : params.selected.slice(0, 2).map((s) => ({ action: `Review supplier exposure for ${s.title}`, rationale: "Recent signal merits contract and supplier check.", owner: "Category" as const, expectedOutcome: "Updated sourcing posture for active deals." }))).map((action, idx) => ({ ...action, sourceIds: [sourceIds[idx % sourceIds.length]].filter(Boolean) })) }]
  };

  const hero = params.selected.find((article) => article.imageUrl)?.imageUrl;
  const title = params.llmResult.title?.trim() || `${params.selected[0]?.title ?? params.agent.label} | ${params.agent.label} sourcing implications`;
  const summary = report.summaryBullets.map((item) => item.text).join(" ").slice(0, 420);

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
    bodyMarkdown: renderMarkdown(title, summary, params.selected, params.indices),
    selectedArticles: params.selected,
    sources,
    topStories: params.selected.map((article, idx) => ({ sourceArticleIndex: idx + 1, title: article.title, url: article.url, sourceName: article.sourceName, publishedAt: article.publishedAt, briefContent: article.briefContent, categoryImportance: article.categoryImportance, keyMetrics: article.keyMetrics })),
    heroImage: { url: hero ?? makeCategoryPlaceholderDataUrl(params.agent.label), alt: params.selected[0]?.title ?? params.agent.label, sourceArticleIndex: 1 },
    heroImageUrl: hero ?? makeCategoryPlaceholderDataUrl(params.agent.label),
    heroImageAlt: params.selected[0]?.title ?? params.agent.label,
    heroImageSourceUrl: params.selected[0]?.url,
    newsStatus: params.selected.length >= 2 ? "ok" : "thin-category",
    deltaSinceLastRun: params.llmResult.deltaBullets.slice(0, 3),
    report,
    qualityReport: { issues: [], decision: "publish" }
  };
}

function buildSources(selected: SelectedArticle[], indices: MarketIndex[]): BriefSource[] {
  const entries: BriefSource[] = [
    ...selected.map((article) => ({ sourceId: buildSourceId(article.url), url: article.url, title: article.title, publishedAt: article.publishedAt })),
    ...indices.map((index) => ({ sourceId: buildSourceId(index.url), url: index.url, title: index.label }))
  ];
  const seen = new Set<string>();
  return entries.filter((source) => {
    if (seen.has(source.sourceId)) return false;
    seen.add(source.sourceId);
    return true;
  });
}

function renderMarkdown(title: string, summary: string, selected: SelectedArticle[], indices: MarketIndex[]): string {
  const lines = [`# ${title}`, "", summary, "", "## Top stories"]; 
  for (const story of selected) {
    lines.push(`- [${story.title}](${story.url}) — ${story.briefContent}`);
  }
  lines.push("", "## Market indices");
  for (const index of indices) {
    lines.push(`- [${index.label}](${index.url})`);
  }
  return lines.join("\n");
}

function validateHardAndRepair(brief: BriefPost, previousBrief?: BriefPost | null): BriefPost {
  const repaired = { ...brief };
  if (!repaired.topStories || repaired.topStories.length === 0) {
    repaired.topStories = [{ sourceArticleIndex: 1, title: repaired.selectedArticles?.[0]?.title ?? repaired.title, url: repaired.selectedArticles?.[0]?.url ?? repaired.sources?.[0]?.url ?? "data:text/plain,source-unavailable" }];
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
    withReport.bodyMarkdown = renderMarkdown(withReport.title, withReport.summary ?? "", selected, []);
    withReport.qualityReport.issues.push("Re-rendered markdown to remove untrusted URLs.");
  }

  return withReport;
}
