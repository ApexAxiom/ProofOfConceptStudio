import assert from "node:assert/strict";
import { buildSourceId, validateBriefV2Record } from "@proof/shared";
import { generateBriefV3 } from "./brief-engine-v3/index.js";

async function main() {
  const nowIso = new Date("2026-01-05T10:00:00.000Z").toISOString();
  const result = await generateBriefV3({
    agent: {
      id: "test-agent",
      portfolio: "subsea-umbilicals",
      label: "Subsea Umbilicals",
      description: "",
      maxArticlesToConsider: 5,
      articlesPerRun: 3,
      feedsByRegion: { au: [], "us-mx-la-lng": [] }
    },
    region: "au",
    runWindow: "apac",
    nowIso,
    runIdentity: { runId: "smoke", briefDay: "2026-01-05" },
    config: { allowLlm: false },
    indices: [{ id: "brent", label: "Brent", url: "https://example.org/brent", regionScope: ["au"] }],
    previousBrief: {
      postId: "prev",
      title: "Previous brief",
      region: "au",
      portfolio: "subsea-umbilicals",
      runWindow: "apac",
      status: "published",
      generationStatus: "published",
      publishedAt: "2026-01-04T10:00:00.000Z",
      bodyMarkdown: "x",
      version: "v2",
      topStories: [{ sourceArticleIndex: 1, title: "Old headline", url: "https://news.example/old" }],
      heroImage: { url: "https://img.example/old.jpg", alt: "old", sourceArticleIndex: 1 },
      deltaSinceLastRun: ["old"]
    },
    articles: [
      { title: "Rig rates rise 12% in APAC", url: "https://news.example/a", content: "Rig rates moved 12% amid demand growth and tighter vessel availability.", sourceName: "EnergyWire", publishedAt: nowIso, ogImageUrl: "https://img.example/a.jpg" },
      { title: "Steel pricing eases 4%", url: "https://news.example/b", content: "Steel inputs eased 4% week-over-week while shipping lead times remain elevated.", sourceName: "MetalNews", publishedAt: nowIso },
      { title: "Tender activity expands", url: "https://news.example/c", content: "Tender volumes expanded with 3 major EPC awards and longer bid windows.", sourceName: "SupplyMonitor", publishedAt: nowIso }
    ]
  });

  const v2 = validateBriefV2Record(result, { hasPreviousBrief: true });
  assert.equal(v2.ok, true);
  assert.ok((result.topStories?.length ?? 0) >= 1);
  assert.ok((result.heroImage?.url ?? "").startsWith("https://") || (result.heroImage?.url ?? "").startsWith("data:image/"));
  assert.ok((result.deltaSinceLastRun?.length ?? 0) >= 1);
  for (const article of result.selectedArticles ?? []) {
    assert.ok(article.procurementLens);
    assert.ok(article.procurementLens?.buyerTakeaway);
    assert.ok(article.procurementLens?.costMoney);
    assert.ok(article.procurementLens?.supplierCommercial);
    assert.ok(article.procurementLens?.safetyOperational);
    assert.ok(article.procurementLens?.watchouts);
    for (const fact of article.keyMetrics ?? []) {
      assert.match(fact, /[a-z]/i);
      assert.doesNotMatch(fact, /^(19|20)\d{2}$/);
      assert.doesNotMatch(fact, /^\d[\d.,%/$-]*$/);
    }
  }

  const impactLabels = new Set((result.report?.impactGroups ?? []).map((group) => group.label));
  assert.ok(impactLabels.has("Cost / money"));
  assert.ok(impactLabels.has("Supplier / commercial"));
  assert.ok(impactLabels.has("Safety / operations"));
  assert.ok(impactLabels.has("What to watch"));

  const allowedUrls = new Set([...(result.selectedArticles ?? []).map((item) => item.url), ...(result.sources ?? []).map((source) => typeof source === "string" ? source : source.url)]);
  const bodyUrls = Array.from(result.bodyMarkdown.matchAll(/\((https?:\/\/[^)]+)\)/g)).map((match) => match[1]);
  assert.ok(bodyUrls.every((url) => allowedUrls.has(url)));

  const knownSourceIds = new Set((result.sources ?? []).map((source) => typeof source === "string" ? buildSourceId(source) : source.sourceId));
  for (const bullet of result.report?.summaryBullets ?? []) {
    assert.ok(bullet.sourceIds.every((sourceId) => knownSourceIds.has(sourceId)));
  }
  for (const group of result.report?.actionGroups ?? []) {
    for (const action of group.actions) {
      assert.ok(action.sourceIds.every((sourceId) => knownSourceIds.has(sourceId)));
    }
  }

  console.log("brief-engine-v3 smoke passed");
}

main();
