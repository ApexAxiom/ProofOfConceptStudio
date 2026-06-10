import assert from "node:assert";
import { BriefPost } from "@proof/shared";
import { buildDigestFromBriefs } from "./build.js";
import { renderDigestHtml, renderDigestSubject, renderDigestText } from "./render.js";

const nowIso = new Date().toISOString();

function brief(partial: Partial<BriefPost> & { postId: string; portfolio: string; title: string }): BriefPost {
  return {
    region: "au",
    runWindow: "apac",
    status: "published",
    publishedAt: nowIso,
    bodyMarkdown: "Body",
    summary: "Summary line [1] for the digest.",
    ...partial
  } as BriefPost;
}

const digest = buildDigestFromBriefs(
  "au",
  [
    brief({ postId: "p-rigs", portfolio: "rigs-integrated-drilling", title: "Valaris wins contract", signalLevel: "act" }),
    brief({ postId: "p-octg", portfolio: "wells-materials-octg", title: "HRC steel slides", signalLevel: "watch" }),
    brief({ postId: "p-site", portfolio: "site-services-facilities", title: "Quiet day", signalLevel: "awareness" }),
    // Older duplicate for the same portfolio must lose to the newer one.
    brief({
      postId: "p-rigs-old",
      portfolio: "rigs-integrated-drilling",
      title: "Old rigs story",
      publishedAt: new Date(Date.now() - 86_400_000).toISOString()
    }),
    // Market dashboard is excluded from category rows.
    brief({ postId: "p-dash", portfolio: "market-dashboard", title: "Dashboard" })
  ],
  nowIso
);

assert.ok(digest, "digest should build");
assert.equal(digest.entries.length, 3, `expected 3 entries, got ${digest.entries.length}`);
assert.equal(digest.entries[0].portfolio, "rigs-integrated-drilling", "act entry sorts first");
assert.equal(digest.entries[0].postId, "p-rigs", "latest brief per portfolio wins");
assert.equal(digest.actCount, 1);
assert.equal(digest.watchCount, 1);
assert.ok(!digest.entries[0].summaryLine.includes("[1]"), "citation tags stripped");

const subject = renderDigestSubject(digest);
assert.ok(subject.includes("1 act"), `subject should carry counts: ${subject}`);

const html = renderDigestHtml(digest);
assert.ok(html.includes("Valaris wins contract"));
assert.ok(html.includes("/brief/p-rigs"));
assert.ok(html.includes("ACT"), "act chip rendered");

const text = renderDigestText(digest);
assert.ok(text.includes("[ACT] Rigs & Integrated Drilling"));

// Empty input → no digest (and therefore no email).
assert.equal(buildDigestFromBriefs("au", [], nowIso), null);

console.log("digest.smoke passed");
