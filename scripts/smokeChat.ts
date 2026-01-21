const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:3001";

type ChatStatus = {
  enabled: boolean;
  model?: string | null;
  runnerConfigured?: boolean;
};

async function fetchStatus(): Promise<ChatStatus> {
  const res = await fetch(`${API_BASE_URL}/chat/status`);
  if (!res.ok) {
    throw new Error(`Status request failed: ${res.status}`);
  }
  return res.json();
}

async function postChat(question: string) {
  const briefsRes = await fetch(`${API_BASE_URL}/posts/latest?region=au`);
  if (!briefsRes.ok) {
    throw new Error(`Briefs request failed: ${briefsRes.status}`);
  }
  const briefs = (await briefsRes.json()) as { postId?: string }[];
  const briefId = briefs?.[0]?.postId;
  const res = await fetch(`${API_BASE_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question,
      region: "au",
      portfolio: "drilling-services",
      briefId
    })
  });
  const json = await res.json();
  return { status: res.status, json };
}

async function main() {
  console.log(`Using API_BASE_URL=${API_BASE_URL}`);
  const status = await fetchStatus();
  console.log("Chat status:", status);

  console.log("Running chat request...");
  const { status: chatStatus, json } = await postChat(
    "Summarize any recent supplier or market risks."
  );
  if (chatStatus !== 200 || typeof json.answer !== "string") {
    throw new Error(`Chat request failed: ${chatStatus} ${JSON.stringify(json)}`);
  }
  if (!Array.isArray(json.citations)) {
    throw new Error(`Chat response missing citations array: ${JSON.stringify(json)}`);
  }
  console.log("Answer (first 200 chars):", json.answer.slice(0, 200));
  console.log(`Citations returned: ${json.citations.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
