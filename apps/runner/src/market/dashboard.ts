import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { AgentConfig, RegionSlug, RunWindow, indicesForRegion } from "@proof/shared";
import { documentClient, tableName } from "../db/client.js";
import { normalizeForDedupe } from "../ingest/url-normalize.js";
import { generateMarketBrief } from "../llm/market-openai.js";
import { MarketCandidate } from "../llm/market-prompts.js";
import { publishBrief, logRunResult } from "../publish/dynamo.js";
import { validateBrief } from "../publish/validate.js";
import { findBestImageFromSources, findImageFromPage } from "../images/image-scraper.js";
import { IngestResult } from "../ingest/fetch.js";

interface RunResult {
  agentId: string;
  region: RegionSlug;
  ok: boolean;
  error?: string;
}

const EXCLUDED_PORTFOLIOS = new Set(["it-telecom-cyber", "professional-services-hr", "market-dashboard"]);

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
      const articles = Array.isArray(item.selectedArticles) ? item.selectedArticles : [];
      for (const art of articles) {
        const normalized = normalizeForDedupe(art.url);
        if (!normalized || seen.has(normalized)) continue;
        seen.add(normalized);
        candidates.push({
          title: art.title,
          url: art.url,
          briefContent: art.briefContent || art.title,
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

    const brief = await generateMarketBrief({ agent, region, runWindow, candidates, indices });
    const validated = validateBrief(brief, allowedUrls, indexUrls);

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

    const ingestStub: IngestResult = { articles: [], scannedSources: [], metrics: {} } as IngestResult;
    await publishBrief(published, ingestStub, runId);
    await logRunResult(runId, agent.id, region, "success");
    return { agentId: agent.id, region, ok: true };
  } catch (error) {
    console.error(`[${agent.id}/${region}] dashboard error`, error);
    await logRunResult(runId, agent.id, region, "failed", (error as Error).message);
    return { agentId: agent.id, region, ok: false, error: (error as Error).message };
  }
}
