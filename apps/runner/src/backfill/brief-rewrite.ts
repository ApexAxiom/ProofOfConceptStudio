import crypto from "node:crypto";
import { BriefPost, BriefV2NewsStatus, RegionSlug, getPortfolioMarketIndices } from "@proof/shared";
import { loadAgents } from "../agents/config.js";
import { generateBriefV3 } from "../brief-engine-v3/index.js";
import { getLatestPublishedBrief } from "../db/previous-brief.js";
import { initializeSecrets } from "../lib/secrets.js";
import type { ArticleInput } from "../llm/openai.js";
import { finalizePublishedBrief } from "../published-brief.js";
import { generateRichValidatedBrief } from "../rich-brief.js";
import {
  collectRewriteSourceCandidates,
  buildRewriteArticleInputs,
  mergeRewrittenBriefItem
} from "./brief-rewrite-lib.js";
import { DynamoBriefItem, fetchPublishedBriefItems, putBriefItem } from "./shared.js";

let richRewriteUnavailableReason: string | null = null;
const MAX_PREVIOUS_BRIEF_LOOKBACK = 30;

function parseArg(name: string): string | undefined {
  const hit = process.argv.find((arg) => arg.startsWith(`${name}=`));
  return hit ? hit.slice(name.length + 1) : undefined;
}

function asPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function runWithLimit<T>(tasks: Array<() => Promise<T>>, limit: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let cursor = 0;

  const worker = async () => {
    while (cursor < tasks.length) {
      const current = cursor;
      cursor += 1;
      results[current] = await tasks[current]();
    }
  };

  return Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker)).then(() => results);
}

function resolveRewriteModel(): string {
  return (
    process.env.BRIEF_REWRITE_MODEL?.trim() ||
    process.env.BRIEF_WRITER_MODEL?.trim() ||
    "gpt-5-mini"
  );
}

function shouldDisableRichRewriteForRun(message: string): boolean {
  return (
    /incorrect api key/i.test(message) ||
    /openai_api_key is not configured/i.test(message) ||
    /insufficient_quota/i.test(message) ||
    /exceeded your current quota/i.test(message) ||
    /^429\b/i.test(message.trim())
  );
}

function isThinSignalDay(articles: Array<{ content?: string; contentStatus?: "ok" | "thin" }>): boolean {
  const usable = articles.filter((article) => (article.content ?? "").trim().length >= 250 && article.contentStatus !== "thin").length;
  return usable < 2;
}

function resolveNewsStatus(articles: Array<{ content?: string; contentStatus?: "ok" | "thin" }>): BriefV2NewsStatus {
  return isThinSignalDay(articles) ? "thin-category" : "ok";
}

function resolveAgentForBrief(brief: BriefPost) {
  const agents = loadAgents();
  return (
    agents.find((agent) => agent.id === brief.agentId) ??
    agents.find((agent) => agent.portfolio === brief.portfolio && agent.feedsByRegion[brief.region]?.length)
  );
}

function stripMarkdown(text?: string): string {
  return (text ?? "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/[#>*_~\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildZeroSourceRewriteInputs(params: {
  brief: BriefPost;
  agentLabel: string;
  indices: ReturnType<typeof getPortfolioMarketIndices>;
}): ArticleInput[] {
  const context = [
    params.brief.summary,
    params.brief.decisionSummary?.topMove,
    ...(params.brief.decisionSummary?.whatChanged ?? []),
    ...(params.brief.decisionSummary?.doNext ?? []),
    ...(params.brief.decisionSummary?.watchThisWeek ?? []),
    stripMarkdown(params.brief.bodyMarkdown).slice(0, 1400)
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  const seedContext =
    context ||
    `${params.agentLabel} historical record retained no article corpus. Treat this as thin-signal category context only and avoid forcing urgency.`;

  const indexSeeds = params.indices.slice(0, Math.max(1, Math.min(2, params.indices.length)));
  if (indexSeeds.length === 0) {
    return [
      {
        title: `${params.agentLabel} historical context note`,
        url: `https://proofofconceptstudio.com/brief/${encodeURIComponent(params.brief.postId)}`,
        content: seedContext,
        sourceName: "Historical brief context",
        publishedAt: params.brief.publishedAt,
        contentStatus: "thin"
      }
    ];
  }

  return indexSeeds.map((index) => ({
    title: `${params.agentLabel} context via ${index.label}`,
    url: index.url,
    content: `${index.label}. ${index.notes ?? ""} ${seedContext}`.replace(/\s+/g, " ").trim(),
    sourceName: "Market Index",
    publishedAt: params.brief.publishedAt,
    contentStatus: "thin"
  }));
}

function hasRewriteCandidates(brief: BriefPost | null | undefined, indices: ReturnType<typeof getPortfolioMarketIndices>): brief is BriefPost {
  if (!brief) return false;
  return collectRewriteSourceCandidates(brief, indices, 1).length > 0;
}

async function findPreviousUsableBrief(params: {
  brief: BriefPost;
  indices: ReturnType<typeof getPortfolioMarketIndices>;
}): Promise<BriefPost | null> {
  let beforeIso = params.brief.publishedAt;

  for (let step = 0; step < MAX_PREVIOUS_BRIEF_LOOKBACK; step += 1) {
    const candidate = await getLatestPublishedBrief({
      portfolio: params.brief.portfolio,
      region: params.brief.region,
      beforeIso
    });
    if (!candidate) return null;
    if (hasRewriteCandidates(candidate, params.indices)) {
      return candidate;
    }

    const candidateDate = new Date((candidate as BriefPost).publishedAt);
    beforeIso = new Date(candidateDate.getTime() - 1).toISOString();
  }

  return null;
}

async function rewriteOnePublishedBrief(params: {
  item: DynamoBriefItem;
  model: string;
  dryRun: boolean;
  runId: string;
}): Promise<{
  postId: string;
  status: "rewritten" | "skipped" | "failed";
  mode?: "rich-openai" | "deterministic";
  error?: string;
}> {
  const { item, model, dryRun, runId } = params;
  const agent = resolveAgentForBrief(item);
  if (!agent) {
    return { postId: item.postId, status: "failed", error: `Agent not found for portfolio ${item.portfolio}` };
  }

  try {
    const indices = getPortfolioMarketIndices(item.portfolio);
    const previousBrief = await getLatestPublishedBrief({
      portfolio: item.portfolio,
      region: item.region,
      beforeIso: item.publishedAt
    });
    const previousUsableBrief = hasRewriteCandidates(previousBrief, indices)
      ? previousBrief
      : await findPreviousUsableBrief({ brief: item, indices });

    let articleInputs: ArticleInput[];
    try {
      articleInputs = await buildRewriteArticleInputs({
        brief: item,
        indices
      });
    } catch (error) {
      const message = (error as Error).message;
      if (/No rewrite article candidates were found on the published brief\./i.test(message) && previousUsableBrief) {
        console.warn(
          JSON.stringify({
            level: "warn",
            event: "brief_rewrite_using_previous_brief_sources",
            postId: item.postId,
            region: item.region,
            portfolio: item.portfolio,
            previousPostId: previousUsableBrief.postId
          })
        );
        articleInputs = await buildRewriteArticleInputs({
          brief: previousUsableBrief,
          indices
        });
      } else if (/No rewrite article candidates were found on the published brief\./i.test(message)) {
        console.warn(
          JSON.stringify({
            level: "warn",
            event: "brief_rewrite_using_index_seed_context",
            postId: item.postId,
            region: item.region,
            portfolio: item.portfolio
          })
        );
        articleInputs = buildZeroSourceRewriteInputs({
          brief: item,
          agentLabel: agent.label,
          indices
        });
      } else {
        throw error;
      }
    }
    const newsStatus = resolveNewsStatus(articleInputs);
    let rewritten: BriefPost | undefined;
    let mode: "rich-openai" | "deterministic" = "rich-openai";

    if (!richRewriteUnavailableReason) {
      try {
        rewritten = await generateRichValidatedBrief({
        agent,
        region: item.region as RegionSlug,
        runWindow: item.runWindow,
        articles: articleInputs,
        indices,
        previousBrief: previousUsableBrief ?? previousBrief,
        nowIso: item.publishedAt,
        newsStatus,
        model
      });
      } catch (error) {
        const message = (error as Error).message;
        if (shouldDisableRichRewriteForRun(message)) {
          richRewriteUnavailableReason = message;
        }
        console.warn(
          JSON.stringify({
            level: "warn",
            event: "brief_rewrite_rich_failed_fallback",
            postId: item.postId,
            region: item.region,
            portfolio: item.portfolio,
            model,
            error: message
          })
        );
      }
    }

    if (!rewritten) {
      mode = "deterministic";
      rewritten = await generateBriefV3({
        agent,
        region: item.region as RegionSlug,
        runWindow: item.runWindow,
        articles: articleInputs,
        indices,
        previousBrief: previousUsableBrief ?? previousBrief,
        nowIso: item.publishedAt,
        runIdentity: {
          runId,
          briefDay: item.briefDay ?? ""
        },
        config: {
          model: process.env.OPENAI_MODEL?.trim(),
          allowLlm: false
        }
      });
    }

    const finalized = finalizePublishedBrief({
      brief: rewritten,
      agent,
      newsStatus,
      previousBrief: previousUsableBrief ?? previousBrief,
      nowIso: item.publishedAt,
      postId: item.postId,
      runKey: item.runKey ?? "",
      briefDay: item.briefDay ?? ""
    });

    const merged = mergeRewrittenBriefItem({
      item,
      rewrittenBrief: finalized
    });

    if (!dryRun) {
      await putBriefItem(merged);
    }

    return { postId: item.postId, status: "rewritten", mode };
  } catch (error) {
    return {
      postId: item.postId,
      status: "failed",
      error: (error as Error).message
    };
  }
}

async function main() {
  await initializeSecrets();

  const dryRun = process.argv.includes("--dry-run");
  const limit = asPositiveInt(parseArg("--limit") ?? process.env.BRIEF_REWRITE_LIMIT, 5_000);
  const concurrency = asPositiveInt(parseArg("--concurrency") ?? process.env.BRIEF_REWRITE_CONCURRENCY, 2);
  const regionArg = parseArg("--region") ?? process.env.BRIEF_REWRITE_REGION;
  const region = regionArg === "au" || regionArg === "us-mx-la-lng" ? regionArg : undefined;
  const model = parseArg("--model") ?? resolveRewriteModel();
  const runId = crypto.randomUUID();

  const items = await fetchPublishedBriefItems({ limit, region: region as RegionSlug | undefined });
  const tasks = items.map((item) => () => rewriteOnePublishedBrief({ item, model, dryRun, runId }));
  const results = await runWithLimit(tasks, concurrency);

  const rewritten = results.filter((result) => result.status === "rewritten");
  const failed = results.filter((result) => result.status === "failed");
  const rewrittenByMode = rewritten.reduce<Record<string, number>>((acc, result) => {
    const key = result.mode ?? "unknown";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  console.log(
    JSON.stringify(
      {
        command: "backfill:brief-rewrite",
        dryRun,
        runId,
        region: region ?? "all",
        limit,
        concurrency,
        model,
        scanned: items.length,
        rewritten: rewritten.length,
        rewrittenByMode,
        failed: failed.length,
        failures: failed.slice(0, 25)
      },
      null,
      2
    )
  );

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
