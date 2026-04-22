import {
  AgentConfig,
  BriefPost,
  BriefV2NewsStatus,
  MarketIndex,
  RegionSlug,
  RunWindow
} from "@proof/shared";
import { generateBrief, type ArticleInput } from "./llm/openai.js";
import { attachEvidenceToBrief } from "./publish/evidence.js";
import { validateNumericClaims } from "./publish/factuality.js";
import { validateBrief } from "./publish/validate.js";

export interface GenerateRichValidatedBriefInput {
  agent: AgentConfig;
  region: RegionSlug;
  runWindow: RunWindow;
  articles: ArticleInput[];
  indices: MarketIndex[];
  previousBrief?: BriefPost | null;
  nowIso: string;
  newsStatus: BriefV2NewsStatus;
  model?: string;
}

export async function generateRichValidatedBrief(
  params: GenerateRichValidatedBriefInput
): Promise<BriefPost> {
  const richBrief = await generateBrief({
    agent: params.agent,
    region: params.region,
    runWindow: params.runWindow,
    articles: params.articles,
    indices: params.indices,
    previousBrief: params.previousBrief ?? undefined,
    newsStatus: params.newsStatus,
    model: params.model
  });

  const evidenceResult = attachEvidenceToBrief({
    brief: {
      ...richBrief,
      publishedAt: params.nowIso
    },
    articles: params.articles,
    nowIso: params.nowIso
  });
  const numericIssues = validateNumericClaims(evidenceResult.brief, params.articles);
  const allIssues = [...numericIssues, ...evidenceResult.issues];
  if (allIssues.length > 0) {
    throw new Error(JSON.stringify(allIssues));
  }

  const allowedUrls = new Set(params.articles.map((article) => article.url));
  const indexUrls = new Set(params.indices.map((index) => index.url));
  return validateBrief(evidenceResult.brief, allowedUrls, indexUrls);
}

export type { ArticleInput };
