import assert from "node:assert/strict";
import { computeKeywordSignals, deriveKeywordPack } from "./fetch.js";

const pack = deriveKeywordPack("drilling-services");
const generalKeywords = ["oil", "gas", "lng", "drilling"];

const candidates = [
  { title: "Offshore drilling contracts surge in LNG basin", summary: "Oil and gas rigs return.", url: "https://example.com/a" },
  { title: "Celebrity interview roundup", summary: "Entertainment news.", url: "https://example.com/b" }
];

const scored = candidates.map((item) => {
  const text = `${item.title} ${item.summary}`.toLowerCase();
  const signals = computeKeywordSignals(text, pack.primary, pack.secondary, pack.exclude, generalKeywords);
  return { item, score: signals.score };
});

scored.sort((a, b) => b.score - a.score);

assert.equal(scored[0]?.item.url, "https://example.com/a", "Relevant article should rank higher than excluded content");
assert.ok(scored[0].score >= scored[1].score, "Scores should be deterministic and ordered");

console.log("ranking.smoke passed");
