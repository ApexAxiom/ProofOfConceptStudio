import assert from "node:assert/strict";
import { MockAgent, setGlobalDispatcher } from "undici";
import { fetchRss } from "./rss.js";

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Example Feed</title>
    <item>
      <title>Test item</title>
      <link>https://example.com/news?id=1&utm_source=test</link>
      <pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

const mockAgent = new MockAgent();
mockAgent.disableNetConnect();
const pool = mockAgent.get("https://example.com");
pool.intercept({ path: "/rss", method: "GET" }).reply(200, xml, {
  headers: { "content-type": "application/rss+xml" }
});
setGlobalDispatcher(mockAgent);

const items = await fetchRss({ name: "Example", url: "https://example.com/rss", type: "rss" });
assert.equal(items.length, 1, "Should parse a single RSS item");
assert.equal(items[0]?.title, "Test item");
assert.ok(items[0]?.link.includes("https://example.com/news"), "Should return resolved link");

console.log("rss.smoke passed");
