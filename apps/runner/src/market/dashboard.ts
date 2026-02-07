import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import {
  AgentConfig,
  BriefPost,
  CategoryGroup,
  RegionSlug,
  RunWindow,
  BriefRunIdentity,
  BriefRunMetrics,
  buildBriefPostId,
  buildBriefRunKey,
  categoryForPortfolio,
  getBriefDayKey,
  indicesForRegion,
  makeCategoryPlaceholderDataUrl,
  validateBriefV2Record
} from "@proof/shared";
import { documentClient, tableName } from "../db/client.js";
import { normalizeForDedupe } from "../ingest/url-normalize.js";
import { generateMarketBrief } from "../llm/market-openai.js";
import { MarketCandidate } from "../llm/market-prompts.js";
import { publishBrief, logBriefRunResult, logBriefRunStart, logRunResult } from "../publish/dynamo.js";
import { validateBrief } from "../publish/validate.js";
import { validateMarketNumericClaims } from "../publish/factuality.js";
import { attachEvidenceToMarketBrief } from "../publish/evidence.js";
import { IngestResult } from "../ingest/fetch.js";
import { cacheHeroImageToS3 } from "../media/cache-hero-image.js";
import { buildTopStories, deriveDeltaSinceLastRun, normalizeNewsStatus } from "../brief-v2.js";
import { getLatestPublishedBrief } from "../db/previous-brief.js";

interface RunResult {
  agentId: string;
  region: RegionSlug;
  ok: boolean;
  status: "published" | "no-updates" | "failed" | "dry-run";
  error?: string;
}

// Exclude only the dashboard itself to avoid feeding prior dashboards back into the dashboard.
const EXCLUDED_PORTFOLIOS = new Set(["market-dashboard"]);

const CATEGORY_GROUP_PRIORITY: CategoryGroup[] = ["energy", "steel", "freight", "facility", "cyber", "services"];

function shortlistWithCategoryCoverage(candidates: MarketCandidate[], requiredCount: number): MarketCandidate[] {
  if (candidates.length <= requiredCount) return candidates.slice(0, requiredCount);

  const byGroup = new Map<CategoryGroup, MarketCandidate[]>();
  for (const c of candidates) {
    const group = c.categoryGroup;
    if (!group) continue;
    const list = byGroup.get(group) ?? [];
    list.push(c);
    byGroup.set(group, list);
  }

  const chosen: MarketCandidate[] = [];
  const chosenUrls = new Set<string>();

  // 1) Take one per category group in priority order when available.
  for (const group of CATEGORY_GROUP_PRIORITY) {
    const list = byGroup.get(group) ?? [];
    const pick = list.find((c) => !chosenUrls.has(c.url));
    if (!pick) continue;
    chosen.push(pick);
    chosenUrls.add(pick.url);
    if (chosen.length >= requiredCount) return chosen;
  }

  // 2) Fill remaining slots with best remaining candidates in original order.
  for (const c of candidates) {
    if (chosenUrls.has(c.url)) continue;
    chosen.push(c);
    chosenUrls.add(c.url);
    if (chosen.length >= requiredCount) break;
  }

  return chosen;
}

function heroBucketConfig() {
  const bucket = process.env.BRIEF_IMAGE_S3_BUCKET?.trim();
  const bucketRegion = process.env.BRIEF_IMAGE_S3_REGION?.trim() || process.env.AWS_REGION?.trim();
  const publicBaseUrl = process.env.BRIEF_IMAGE_PUBLIC_BASE_URL?.trim();
  if (!bucket || !bucketRegion || !publicBaseUrl) return null;
  return { bucket, bucketRegion, publicBaseUrl };
}

export async function runMarketDashboard(
  agent: AgentConfig,
  region: RegionSlug,
  runWindow: RunWindow,
  runId: string,
  options?: { dryRun?: boolean; runDate?: string }
): Promise<RunResult> {
  try {
    const dryRun = options?.dryRun ?? false;
    const runNow = options?.runDate ? new Date(options.runDate) : new Date();
    if (Number.isNaN(runNow.getTime())) {
      throw new Error(`Invalid runDate provided: ${options?.runDate}`);
    }
    const briefDay = getBriefDayKey(region, runNow);
    const runIdentity: BriefRunIdentity = {
      briefDay,
      region,
      portfolio: agent.portfolio,
      runWindow
    };
    const runKey = buildBriefRunKey(runIdentity);
    const postId = buildBriefPostId(runIdentity);
    await logBriefRunStart(runIdentity, runId, runNow.toISOString(), dryRun);
    const previousBrief = await getLatestPublishedBrief({
      portfolio: agent.portfolio,
      region,
      beforeIso: runNow.toISOString()
    });
    const lookbackDays = agent.lookbackDays ?? 2;
    const since = new Date();
    since.setDate(since.getDate() - Math.max(lookbackDays, 1));
    const sinceIso = since.toISOString();

    const query = await documentClient.send(
      new QueryCommand({
        TableName: tableName,
        IndexName: "GSI2",
        KeyConditionExpression: "GSI2PK = :pk AND GSI2SK >= :since",
        ExpressionAttributeValues: {
          ":pk": `REGION#${region}`,
          ":since": `DATE#${sinceIso}`,
          ":status": "published"
        },
        ExpressionAttributeNames: { "#status": "status" },
        FilterExpression: "#status = :status"
      })
    );

    const candidates: MarketCandidate[] = [];
    const seen = new Set<string>();
    for (const item of query.Items ?? []) {
      if (EXCLUDED_PORTFOLIOS.has(item.portfolio)) continue;
      const portfolio = typeof item.portfolio === "string" ? item.portfolio : undefined;
      const categoryGroup = portfolio ? categoryForPortfolio(portfolio) : undefined;
      const articles = Array.isArray(item.selectedArticles) ? item.selectedArticles : [];
      for (const art of articles) {
        const normalized = normalizeForDedupe(art.url);
        if (!normalized || seen.has(normalized)) continue;
        seen.add(normalized);
        candidates.push({
          title: art.title,
          url: art.url,
          briefContent: art.briefContent || art.title,
          portfolio,
          categoryGroup,
          sourceName: art.sourceName,
          imageUrl: art.imageUrl
        });
        if (candidates.length >= 20) break;
      }
      if (candidates.length >= 20) break;
    }

    if (candidates.length === 0) {
      const error = "No candidate articles available for dashboard";
      await logRunResult(runId, agent.id, region, "no-updates", error);
      await logBriefRunResult({
        identity: runIdentity,
        runId,
        status: dryRun ? "dry-run" : "no-updates",
        finishedAt: new Date().toISOString(),
        metrics: {
          sourcesFetched: 0,
          itemsCollected: 0,
          itemsDeduped: 0,
          itemsExtracted: 0,
          itemsSelected: 0,
          briefLength: 0
        },
        error,
        dryRun
      });
      return { agentId: agent.id, region, ok: true, status: "no-updates", error };
    }

    const buildMetrics = (params: {
      selectedCount: number;
      briefLength: number;
      usage?: BriefPost["llmUsage"];
    }): BriefRunMetrics => ({
      sourcesFetched: 0,
      itemsCollected: candidates.length,
      itemsDeduped: candidates.length,
      itemsExtracted: candidates.length,
      itemsSelected: params.selectedCount,
      briefLength: params.briefLength,
      promptTokens: params.usage?.promptTokens,
      completionTokens: params.usage?.completionTokens,
      totalTokens: params.usage?.totalTokens
    });

    const indices = indicesForRegion(agent.portfolio, region);
    const indexUrls = new Set(indices.map((i) => i.url));
    const allowedUrls = new Set([...candidates.map((c) => c.url), ...indexUrls]);

    // Shortlist candidates to ensure broad category coverage in the dashboard selection.
    // By passing exactly N candidates where N == requiredCount, we strongly constrain selection to be category-balanced.
    const requiredCount = Math.min(agent.articlesPerRun ?? 5, Math.max(1, Math.min(8, candidates.length)));
    const shortlisted = shortlistWithCategoryCoverage(candidates, requiredCount);

    const parseIssues = (err: unknown): string[] => {
      try {
        return JSON.parse((err as Error).message);
      } catch {
        return [(err as Error).message];
      }
    };

    const runValidation = (candidate: BriefPost) => {
      const issues: string[] = [];
      let validatedBrief: BriefPost | undefined;
      const numericIssues = validateMarketNumericClaims(candidate, shortlisted);
      const evidenceResult = attachEvidenceToMarketBrief({ brief: candidate, candidates: shortlisted });
      try {
        validatedBrief = validateBrief(evidenceResult.brief, allowedUrls, indexUrls);
      } catch (err) {
        issues.push(...parseIssues(err));
      }
      issues.push(...numericIssues);
      issues.push(...evidenceResult.issues);
      return { validatedBrief, issues };
    };

    let brief = await generateMarketBrief({
      agent: { ...agent, articlesPerRun: requiredCount },
      region,
      runWindow,
      candidates: shortlisted,
      indices
    });

    let { validatedBrief, issues } = runValidation(brief);

    if (issues.length > 0) {
      const retryBrief = await generateMarketBrief({
        agent: { ...agent, articlesPerRun: requiredCount },
        region,
        runWindow,
        candidates: shortlisted,
        indices,
        repairIssues: issues,
        previousJson: JSON.stringify(brief)
      });

      brief = retryBrief;
      const retryResult = runValidation(retryBrief);
      validatedBrief = retryResult.validatedBrief;
      issues = retryResult.issues;
    }

    if (issues.length > 0 || !validatedBrief) {
      const failedBrief = {
        ...brief,
        agentId: agent.id,
        generationStatus: "generation-failed" as const,
        briefDay,
        status: "draft" as const,
        bodyMarkdown: `Evidence validation failed. Needs review. Issues: ${issues.join("; ")}`,
        sources: [],
        qualityReport: { issues, decision: "block" as const }
      };

      try {
        await publishBrief(
          failedBrief,
          { articles: [], scannedSources: [], metrics: { collectedCount: 0, dedupedCount: 0, extractedCount: 0 } },
          runId
        );
      } catch (publishError) {
        console.error(`[${agent.id}/${region}] Failed to write validation failure brief`, publishError);
      }
      await logRunResult(runId, agent.id, region, "failed", issues.join("; "));
      return { agentId: agent.id, region, ok: false, status: "failed", error: issues.join("; ") };
    }

    const validated = validatedBrief;
    const selectedArticles = validated.selectedArticles ?? [];
    const topStories = buildTopStories(selectedArticles);
    const newsStatus = normalizeNewsStatus("ok", topStories);
    const deltaSinceLastRun = deriveDeltaSinceLastRun({
      currentDelta: validated.deltaSinceLastRun,
      topStories,
      previousBrief
    });

    const heroBySourceUrl = selectedArticles.find(
      (article) => article.url === validated.heroImageSourceUrl && article.imageUrl
    );
    const firstWithImage = selectedArticles.find((article) => article.imageUrl);
    const fallbackSource = selectedArticles.find((article) => article.url === validated.heroImageSourceUrl) ?? selectedArticles[0];
    const heroCandidate = heroBySourceUrl ?? firstWithImage ?? fallbackSource;
    const sourceArticleIndex = heroCandidate?.sourceIndex ?? 1;

    const cacheConfig = heroBucketConfig();
    const cachedHero = cacheConfig && heroCandidate?.imageUrl
      ? await cacheHeroImageToS3({
          ogImageUrl: heroCandidate.imageUrl,
          categorySlug: agent.portfolio,
          region,
          publishedDateISO: validated.publishedAt,
          articleIndex: sourceArticleIndex,
          bucket: cacheConfig.bucket,
          bucketRegion: cacheConfig.bucketRegion,
          publicBaseUrl: cacheConfig.publicBaseUrl
        })
      : null;

    const heroImageUrl = cachedHero?.url ?? makeCategoryPlaceholderDataUrl(agent.label);
    const heroImageAlt =
      validated.heroImageAlt?.trim() || heroCandidate?.imageAlt?.trim() || heroCandidate?.title || validated.title;

    const published: BriefPost = {
      ...validated,
      postId,
      runKey,
      agentId: agent.id,
      generationStatus: "published",
      briefDay,
      version: "v2",
      newsStatus,
      selectedArticles,
      topStories,
      deltaSinceLastRun,
      heroImage: {
        url: heroImageUrl,
        alt: heroImageAlt,
        sourceArticleIndex,
        cacheKey: cachedHero?.cacheKey
      },
      heroImageUrl,
      heroImageSourceUrl: heroCandidate?.url || validated.heroImageSourceUrl,
      heroImageAlt
    };

    const v2Validation = validateBriefV2Record(published, { hasPreviousBrief: Boolean(previousBrief) });
    if (!v2Validation.ok) {
      throw new Error(`BriefV2 validation failed: ${v2Validation.issues.join("; ")}`);
    }

    const ingestStub: IngestResult = { 
      articles: [], 
      scannedSources: [], 
      metrics: { collectedCount: 0, dedupedCount: 0, extractedCount: 0 } 
    };
    try {
      if (!dryRun) {
        await publishBrief(published, ingestStub, runId);
      }
    } catch (publishError) {
      console.error(`[${agent.id}/${region}] Failed to publish dashboard brief`, { briefDay }, publishError);
      await logRunResult(runId, agent.id, region, "failed", (publishError as Error).message);
      await logBriefRunResult({
        identity: runIdentity,
        runId,
        status: "failed",
        finishedAt: new Date().toISOString(),
        metrics: buildMetrics({
          selectedCount: published.selectedArticles?.length ?? 0,
          briefLength: published.bodyMarkdown?.length ?? 0,
          usage: published.llmUsage
        }),
        error: (publishError as Error).message,
        dryRun
      });
      return { agentId: agent.id, region, ok: false, status: "failed", error: (publishError as Error).message };
    }
    await logRunResult(runId, agent.id, region, dryRun ? "dry-run" : "published");
    await logBriefRunResult({
      identity: runIdentity,
      runId,
      status: dryRun ? "dry-run" : "succeeded",
      finishedAt: new Date().toISOString(),
      metrics: buildMetrics({
        selectedCount: published.selectedArticles?.length ?? 0,
        briefLength: published.bodyMarkdown?.length ?? 0,
        usage: published.llmUsage
      }),
      dryRun
    });
    return { agentId: agent.id, region, ok: true, status: dryRun ? "dry-run" : "published" };
  } catch (error) {
    console.error(`[${agent.id}/${region}] dashboard error`, error);
    await logRunResult(runId, agent.id, region, "failed", (error as Error).message);
    await logBriefRunResult({
      identity: runIdentity,
      runId,
      status: "failed",
      finishedAt: new Date().toISOString(),
      metrics: {
        sourcesFetched: 0,
        itemsCollected: 0,
        itemsDeduped: 0,
        itemsExtracted: 0,
        itemsSelected: 0,
        briefLength: 0
      },
      error: (error as Error).message,
      dryRun
    });
    return { agentId: agent.id, region, ok: false, status: "failed", error: (error as Error).message };
  }
}
