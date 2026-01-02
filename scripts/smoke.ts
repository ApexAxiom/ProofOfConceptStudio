import { getCronSecret } from "@proof/shared";

const RUNNER_BASE_URL = process.env.RUNNER_BASE_URL ?? "http://localhost:3002";
const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:3001";
const CRON_SECRET = getCronSecret();

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function triggerRun() {
  const res = await fetch(`${RUNNER_BASE_URL}/cron`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CRON_SECRET}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ runWindow: "am" })
  });
  if (!res.ok) {
    throw new Error(`Cron trigger failed: ${res.status}`);
  }
  return res.json();
}

async function pollPosts(region: string) {
  const res = await fetch(`${API_BASE_URL}/posts/latest?region=${region}`);
  if (!res.ok) return [];
  return res.json();
}

async function main() {
  console.log("Triggering runner...");
  await triggerRun();
  const regions = ["au", "us-mx-la-lng"];
  for (let attempt = 0; attempt < 12; attempt++) {
    console.log(`Polling attempt ${attempt + 1}...`);
    for (const region of regions) {
      const posts = await pollPosts(region);
      if (posts.length > 0) {
        console.log("Smoke success: posts available for", region);
        return;
      }
    }
    await sleep(5000);
  }
  throw new Error("Smoke check failed: no posts returned in time");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
