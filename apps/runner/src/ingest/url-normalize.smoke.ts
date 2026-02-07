import assert from "node:assert/strict";
import { canonicalizeUrl } from "@proof/shared";
import { normalizeForDedupe } from "./url-normalize.js";

const raw = "https://www.example.com/path/?utm_source=test&gclid=abc123#section";
const expected = "https://example.com/path";

assert.equal(canonicalizeUrl(raw), expected, "canonicalizeUrl should strip tracking params and fragments");
assert.equal(normalizeForDedupe(raw), expected, "normalizeForDedupe should match canonicalized URL");

const preserved = "https://news.example.com/article?id=42";
assert.equal(canonicalizeUrl(preserved), preserved, "canonicalizeUrl should preserve non-tracking params");

console.log("url-normalize.smoke passed");
