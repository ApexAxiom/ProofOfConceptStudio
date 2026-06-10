#!/usr/bin/env node
/**
 * Post-deploy asset smoke test.
 *
 * Fetches the deployed homepage and asserts every referenced stylesheet and
 * script responds 200 with the right content type. Catches the failure mode
 * where stale HTML references hashed /_next/static assets that a newer deploy
 * purged — which renders the site completely unstyled.
 *
 * Usage: SITE_URL=https://proofofconceptstudio.com node scripts/asset-smoke.mjs
 */

const siteUrl = (process.env.SITE_URL ?? process.argv[2] ?? "https://proofofconceptstudio.com").replace(/\/$/, "");

// Plain fetch UAs can be rejected by WAF rules; identify as a browser.
const headers = {
  "user-agent":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
};

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
}

const response = await fetch(`${siteUrl}/`, { headers });
if (!response.ok) {
  fail(`homepage returned HTTP ${response.status}`);
  process.exit(1);
}
const html = await response.text();

const stylesheets = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)].map((m) => m[1]);
const scripts = [...html.matchAll(/<script[^>]+src="(\/_next\/[^"]+)"/g)].map((m) => m[1]);

if (stylesheets.length === 0) {
  fail("homepage HTML references no stylesheets");
}

const checks = [
  ...stylesheets.map((href) => ({ href, type: "text/css" })),
  ...scripts.map((href) => ({ href, type: "javascript" }))
];

for (const { href, type } of checks) {
  const url = href.startsWith("http") ? href : `${siteUrl}${href}`;
  const asset = await fetch(url, { headers });
  const contentType = asset.headers.get("content-type") ?? "";
  if (!asset.ok) {
    fail(`${href} returned HTTP ${asset.status}`);
  } else if (!contentType.includes(type)) {
    fail(`${href} has content-type "${contentType}" (expected ${type})`);
  } else {
    console.log(`ok: ${href} (${asset.status} ${contentType})`);
  }
}

if (process.exitCode === 1) {
  console.error("\nAsset smoke test FAILED — deployed HTML references assets that do not load.");
  process.exit(1);
}
console.log(`\nAsset smoke test passed for ${siteUrl} (${checks.length} assets).`);
