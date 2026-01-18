import assert from "node:assert";
import { selectHeroArticle } from "./hero-selection.js";
import { SelectedArticle } from "@proof/shared";

const selectedArticles: SelectedArticle[] = [
  {
    title: "Second",
    url: "https://example.com/second",
    briefContent: "Brief 2",
    sourceIndex: 2
  },
  {
    title: "First",
    url: "https://example.com/first",
    briefContent: "Brief 1",
    sourceIndex: 1
  },
  {
    title: "Third",
    url: "https://example.com/third",
    briefContent: "Brief 3",
    sourceIndex: 3
  }
];

const heroArticle = selectHeroArticle(selectedArticles, 2);

assert.strictEqual(heroArticle?.url, "https://example.com/second");

console.log("hero-selection.smoke passed");
