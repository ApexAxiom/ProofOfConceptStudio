import assert from "node:assert/strict";
import { toBriefViewModelV2, validateBriefV2Record } from "@proof/shared";

const legacyBrief = {
  postId: "legacy-1",
  title: "Generic Daily Brief",
  region: "au",
  portfolio: "drilling-services",
  publishedAt: "2026-02-05T01:00:00.000Z",
  deltaSinceLastRun: [],
  selectedArticles: [
    {
      sourceIndex: 1,
      title: "Lead contract award raises offshore vessel demand",
      url: "https://example.com/story-1",
      briefContent: "A short brief.",
      categoryImportance: "Impacts supplier slot availability."
    }
  ]
};

const vm = toBriefViewModelV2(legacyBrief);
assert.equal(vm.region, "au");
assert.equal(vm.topStories.length, 1);
assert.ok(vm.heroImage.url.startsWith("data:image/svg+xml"), "legacy briefs should map to placeholder hero image");
assert.ok(!/daily brief/i.test(vm.title), "title should be normalized away from generic 'daily brief' phrasing");

const invalidV2 = {
  ...legacyBrief,
  version: "v2" as const,
  newsStatus: "ok" as const,
  topStories: vm.topStories,
  heroImage: { url: vm.heroImage.url, alt: vm.heroImage.alt, sourceArticleIndex: 1 },
  deltaSinceLastRun: []
};

const invalidResult = validateBriefV2Record(invalidV2, { hasPreviousBrief: true });
assert.equal(invalidResult.ok, false);
assert.ok(
  invalidResult.issues.some((issue) => issue.includes("deltaSinceLastRun")),
  "v2 briefs with previous context must include delta bullets"
);

const validV2 = {
  ...invalidV2,
  deltaSinceLastRun: ["Lead coverage shifted toward offshore capacity constraints."]
};
const validResult = validateBriefV2Record(validV2, { hasPreviousBrief: true });
assert.equal(validResult.ok, true);

console.log("brief-v2.smoke passed");

