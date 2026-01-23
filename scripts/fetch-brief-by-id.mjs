#!/usr/bin/env node
const postId = process.argv[2];

if (!postId) {
  console.error("Usage: node scripts/fetch-brief-by-id.mjs <postId>");
  process.exit(1);
}

const baseUrl = process.env.API_BASE_URL || "http://localhost:8080";
const url = `${baseUrl.replace(/\\/$/, "")}/posts/${encodeURIComponent(postId)}`;

try {
  const response = await fetch(url);
  if (!response.ok) {
    console.error(`Request failed (${response.status}): ${response.statusText}`);
    process.exit(1);
  }
  const json = await response.json();
  console.log(JSON.stringify(json, null, 2));
} catch (error) {
  console.error("Failed to fetch brief:", error);
  process.exit(1);
}
