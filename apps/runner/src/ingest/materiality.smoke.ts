import assert from "node:assert";
import { assessArticleMateriality, deriveSignalLevel } from "./materiality.js";

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}

// 1) Contract award naming a registry supplier outranks generic market color.
const award = assessArticleMateriality({
  title: "Valaris secures multi-year drillship contract offshore Australia",
  summary: "Valaris has been awarded a two-year contract for the drillship VALARIS DS-9.",
  publishedAt: hoursAgo(6),
  portfolio: "rigs-integrated-drilling",
  region: "au"
});
assert.equal(award.eventType, "contract-award", `expected contract-award, got ${award.eventType}`);
assert.ok(award.supplierMatches >= 1, "expected Valaris to match the rigs supplier registry");

const marketColor = assessArticleMateriality({
  title: "Analysts weigh outlook for global energy markets in 2026",
  summary: "A broad look at energy demand trends.",
  publishedAt: hoursAgo(6),
  portfolio: "rigs-integrated-drilling",
  region: "au"
});
assert.equal(marketColor.eventType, "market-context");
assert.ok(
  award.materialityScore > marketColor.materialityScore + 10,
  `award (${award.materialityScore}) should clearly outrank market color (${marketColor.materialityScore})`
);

// 2) Alias matching: Schlumberger consolidates onto SLB.
const alias = assessArticleMateriality({
  title: "Schlumberger flags pricing discipline on directional drilling work",
  summary: "The service giant signalled rate increases.",
  publishedAt: hoursAgo(30),
  portfolio: "drilling-services",
  region: "us-mx-la-lng"
});
assert.ok(alias.entities.includes("SLB"), `expected alias to resolve to SLB, got ${alias.entities.join(", ")}`);

// 3) Region scoping: AU-only suppliers don't match in the Americas region.
const regionScoped = assessArticleMateriality({
  title: "MMA Offshore adds vessel capacity",
  summary: "Fleet update.",
  publishedAt: hoursAgo(5),
  portfolio: "logistics-marine-aviation",
  region: "us-mx-la-lng"
});
assert.ok(
  !regionScoped.entities.includes("MMA Offshore"),
  "MMA Offshore is AU-scoped and should not match for us-mx-la-lng"
);

// 4) Event classification breadth.
const cases: Array<[string, string]> = [
  ["Tenaris files for anti-dumping review of OCTG imports", "regulatory-tariff"],
  ["Offshore workers union votes to strike at LNG facilities", "labor"],
  ["Woodside takes FID on browse gas project", "project-fid-milestone"],
  ["HRC steel prices rose 8% this month on mill outages", "price-cost"],
  ["Helicopter operator enters chapter 11 bankruptcy protection", "financial-distress"],
  ["Fire breaks out at Gulf coast LNG terminal", "incident-forcemajeure"]
];
for (const [title, expected] of cases) {
  const result = assessArticleMateriality({
    title,
    publishedAt: hoursAgo(2),
    portfolio: "wells-materials-octg",
    region: "us-mx-la-lng"
  });
  assert.equal(result.eventType, expected, `"${title}" → expected ${expected}, got ${result.eventType}`);
}

// 5) Signal level derivation.
assert.equal(deriveSignalLevel([]), "awareness");
assert.equal(deriveSignalLevel([marketColor]), "awareness");
assert.equal(deriveSignalLevel([award]), "act");
const priceMove = assessArticleMateriality({
  title: "Dayrates for jackups climbed again this quarter",
  publishedAt: hoursAgo(3),
  portfolio: "rigs-integrated-drilling",
  region: "au"
});
assert.equal(deriveSignalLevel([priceMove, marketColor]), "watch");

console.log("materiality.smoke passed");
