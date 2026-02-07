import assert from "node:assert/strict";
import { validateBriefV2Record } from "@proof/shared";

const validBrief = {
  version: "v2",
  newsStatus: "ok",
  heroImage: {
    url: "https://example.com/hero.jpg",
    alt: "Hero image",
    sourceArticleIndex: 1
  },
  topStories: [
    {
      sourceArticleIndex: 1,
      title: "Example story",
      url: "https://example.com/story"
    }
  ],
  deltaSinceLastRun: ["New supplier award in LNG contracts."]
};

const okResult = validateBriefV2Record(validBrief, { hasPreviousBrief: true });
assert.equal(okResult.ok, true, `Expected valid brief, got issues: ${okResult.issues.join(", ")}`);

const invalidBrief = {
  version: "v2",
  newsStatus: "ok",
  topStories: []
};
const invalidResult = validateBriefV2Record(invalidBrief);
assert.equal(invalidResult.ok, false);
assert.ok(invalidResult.issues.length > 0);

console.log("brief-v2-validation.smoke passed");
