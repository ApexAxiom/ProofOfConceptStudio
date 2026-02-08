import { getCronSecret } from "@proof/shared";

const RUNNER_BASE_URL = process.env.RUNNER_BASE_URL ?? "http://localhost:3002";
const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:3001";
const CRON_SECRET = getCronSecret();
const DEFAULT_REGIONS = ["au", "us-mx-la-lng"] as const;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type RunnerAgent = {
  id: string;
  region: string;
  portfolio: string;
};

function runWindowForRegion(region: string): "apac" | "international" {
  return region === "au" ? "apac" : "international";
}

async function fetchRunnerAgents(): Promise<RunnerAgent[]> {
  const res = await fetch(`${RUNNER_BASE_URL}/agents`);
  if (!res.ok) {
    throw new Error(`Runner /agents failed: ${res.status}`);
  }
  const payload = (await res.json()) as { agents?: RunnerAgent[] };
  return payload.agents ?? [];
}

async function triggerMinimalDryRun(params: { region: string; agentId: string }) {
  const res = await fetch(`${RUNNER_BASE_URL}/cron`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CRON_SECRET}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      regions: [params.region],
      agentIds: [params.agentId],
      runWindow: runWindowForRegion(params.region),
      dryRun: true,
      waitForCompletion: true
    })
  });
  if (!res.ok) {
    throw new Error(`Cron dry-run failed: ${res.status}`);
  }
  return res.json() as Promise<{
    runId: string;
    results: Array<{
      ok: boolean;
      published: number;
      noUpdates: number;
      failed: number;
      dryRun: number;
      missingCount: number;
    }>;
  }>;
}

async function pollPosts(region: string) {
  try {
    const res = await fetch(`${API_BASE_URL}/posts/latest?region=${region}`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function main() {
  const regions = (process.env.SMOKE_REGIONS ?? DEFAULT_REGIONS.join(","))
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean);

  console.log("Fetching runner agents...");
  const agents = await fetchRunnerAgents();
  if (agents.length === 0) throw new Error("Runner returned zero agents");

  for (const region of regions) {
    const candidate =
      agents.find((a) => a.region === region && a.portfolio !== "market-dashboard") ??
      agents.find((a) => a.region === region);

    if (!candidate) throw new Error(`No agent found for region: ${region}`);

    console.log(`Triggering minimal dry-run for ${region} (${candidate.id})...`);
    const cronResult = await triggerMinimalDryRun({ region, agentId: candidate.id });
    const runResult = cronResult.results?.[0];
    if (!runResult?.ok || runResult.failed > 0) {
      throw new Error(`Dry-run failed for ${region}: ${JSON.stringify(runResult ?? {})}`);
    }

    // Optional: verify API read path is reachable (does not require new briefs to exist).
    for (let attempt = 0; attempt < 3; attempt++) {
      const posts = await pollPosts(region);
      if (Array.isArray(posts)) break;
      await sleep(1000);
    }

    console.log(`Smoke success for ${region}: dry-run ok.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
