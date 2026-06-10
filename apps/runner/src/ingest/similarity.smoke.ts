import assert from "node:assert";
import { isNearDuplicateTitle, titleTokens, tokenSetSimilarity } from "./similarity.js";

const recent = [
  "Valaris wins two-year drillship contract with Petrobras offshore Brazil",
  "NOPSEMA approves Woodside environment plan for Scarborough drilling"
].map((title) => titleTokens(title));

// Same story, different outlet phrasing → near-duplicate.
assert.ok(
  isNearDuplicateTitle("Petrobras awards Valaris two-year drillship contract offshore Brazil", recent),
  "reworded headline for the same award should be flagged"
);

// Same entities, different event → not a duplicate.
assert.ok(
  !isNearDuplicateTitle("Valaris reports quarterly earnings beat on higher dayrates", recent),
  "different Valaris story should not be flagged"
);

// Unrelated story → not a duplicate.
assert.ok(
  !isNearDuplicateTitle("Tenaris raises OCTG prices on steel cost inflation", recent),
  "unrelated story should not be flagged"
);

// Sanity on the similarity metric itself.
const a = titleTokens("Subsea 7 awarded SURF contract for Gulf of Mexico project");
const b = titleTokens("Subsea 7 wins SURF contract for Gulf of Mexico development");
assert.ok(tokenSetSimilarity(a, b) >= 0.6, "high-overlap headlines should score above threshold");

console.log("similarity.smoke passed");
