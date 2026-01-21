import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { AgentConfig, BriefPost, CategoryGroup, RegionSlug, RunWindow, categoryForPortfolio, indicesForRegion } from "@proof/shared";
import { documentClient, tableName } from "../db/client.js";
import { normalizeForDedupe } from "../ingest/url-normalize.js";
import { generateMarketBrief } from "../llm/market-openai.js";
import { MarketCandidate } from "../llm/market-prompts.js";
import { publishBrief, logRunResult } from "../publish/dynamo.js";
import { validateBrief } from "../publish/validate.js";
import { validateMarketNumericClaims } from "../publish/factuality.js";
import { findBestImageFromSources, findImageFromPage } from "../images/image-scraper.js";
import { IngestResult } from "../ingest/fetch.js";

interface RunResult {
  agentId: string;
  region: RegionSlug;
  ok: boolean;
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

export async function runMarketDashboard(
  agent: AgentConfig,
  region: RegionSlug,
  runWindow: RunWindow,
  runId: string
): Promise<RunResult> {
  try {
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
      await logRunResult(runId, agent.id, region, "failed", error);
      return { agentId: agent.id, region, ok: false, error };
    }

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
      try {
        validatedBrief = validateBrief(candidate, allowedUrls, indexUrls);
      } catch (err) {
        issues.push(...parseIssues(err));
      }
      issues.push(...validateMarketNumericClaims(candidate, shortlisted));
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
        status: "failed" as const,
        bodyMarkdown: `Validation failed. Issues: ${issues.join("; ")}`,
        sources: [],
        qualityReport: { issues, decision: "block" as const }
      };

      await publishBrief(failedBrief, { articles: [], scannedSources: [], metrics: { collectedCount: 0, dedupedCount: 0, extractedCount: 0 } }, runId);
      await logRunResult(runId, agent.id, region, "failed", issues.join("; "));
      return { agentId: agent.id, region, ok: false, error: issues.join("; ") };
    }

    const validated = validatedBrief;

    const enrichedArticles = await Promise.all(
      (validated.selectedArticles || []).map(async (article) => {
        if (article.imageUrl && article.imageUrl.startsWith("http")) {
          return article;
        }
        const scraped = await findImageFromPage(article.url);
        if (scraped?.url) {
          return { ...article, imageUrl: scraped.url, imageAlt: scraped.alt ?? article.imageAlt };
        }
        return article;
      })
    );

    const heroFromSelection = enrichedArticles.find((a) => a.url === validated.heroImageSourceUrl) || enrichedArticles[0];
    let heroImageUrl = heroFromSelection?.imageUrl || validated.heroImageUrl;
    let heroImageAlt = validated.heroImageAlt || heroFromSelection?.title || validated.title;

    if (!heroImageUrl) {
      const scrapedHero = await findBestImageFromSources(
        enrichedArticles.map((a) => ({ url: a.url, title: a.title, publisher: a.sourceName }))
      );
      heroImageUrl = scrapedHero?.url;
      heroImageAlt = heroImageAlt || scrapedHero?.alt || validated.title;
    }

    const published = {
      ...validated,
      selectedArticles: enrichedArticles,
      heroImageUrl,
      heroImageSourceUrl: heroFromSelection?.url || validated.heroImageSourceUrl,
      heroImageAlt
    };

    const ingestStub: IngestResult = { 
      articles: [], 
      scannedSources: [], 
      metrics: { collectedCount: 0, dedupedCount: 0, extractedCount: 0 } 
    };
    await publishBrief(published, ingestStub, runId);
    await logRunResult(runId, agent.id, region, "success");
    return { agentId: agent.id, region, ok: true };
  } catch (error) {
    console.error(`[${agent.id}/${region}] dashboard error`, error);
    await logRunResult(runId, agent.id, region, "failed", (error as Error).message);
    return { agentId: agent.id, region, ok: false, error: (error as Error).message };
  }
}
