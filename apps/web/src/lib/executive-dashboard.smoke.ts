import assert from "node:assert/strict";
import { GET } from "../app/api/executive-dashboard/route.js";

async function main() {
  const response = await GET();
  assert.equal(response.status, 200, "executive dashboard endpoint should return 200");

  const payload = (await response.json()) as {
    generatedAt?: string;
    market?: { quotes?: unknown[]; source?: string; lastUpdated?: string };
    woodside?: { articles?: unknown[]; lastUpdated?: string };
    apac?: { articles?: unknown[]; lastUpdated?: string };
    international?: { articles?: unknown[]; lastUpdated?: string };
  };

  assert.ok(payload.generatedAt, "generatedAt is required");
  assert.ok(Array.isArray(payload.market?.quotes), "market.quotes must be an array");
  assert.ok((payload.market?.quotes ?? []).length > 0, "market.quotes should not be empty");
  assert.ok(payload.market?.lastUpdated, "market.lastUpdated is required");
  assert.ok(payload.market?.source, "market.source is required");
  assert.ok(Array.isArray(payload.woodside?.articles), "woodside.articles must be an array");
  assert.ok(Array.isArray(payload.apac?.articles), "apac.articles must be an array");
  assert.ok(Array.isArray(payload.international?.articles), "international.articles must be an array");
  assert.ok(payload.woodside?.lastUpdated, "woodside.lastUpdated is required");
  assert.ok(payload.apac?.lastUpdated, "apac.lastUpdated is required");
  assert.ok(payload.international?.lastUpdated, "international.lastUpdated is required");

  console.log("executive-dashboard.smoke passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
