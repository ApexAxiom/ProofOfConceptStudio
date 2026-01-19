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
  const res = await fetch(`${API_BASE_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question,
      region: "au",
      portfolio: "drilling"
    })
  });
  const json = await res.json();
  return { status: res.status, json };
}

async function main() {
  console.log(`Using API_BASE_URL=${API_BASE_URL}`);
  const status = await fetchStatus();
  console.log("Chat status:", status);

  if (status.enabled) {
    console.log("Running happy-path chat request...");
    const { status: chatStatus, json } = await postChat(
      "Summarize any recent supplier or market risks."
    );
    if (chatStatus !== 200 || typeof json.answer !== "string") {
      throw new Error(`Happy path failed: ${chatStatus} ${JSON.stringify(json)}`);
    }
    console.log("Answer (first 200 chars):", json.answer.slice(0, 200));
  } else {
    console.log("Happy path skipped because AI is disabled on the API.");
  }

  if (!status.enabled) {
    console.log("Running missing-API-key fallback check...");
    const { status: chatStatus, json } = await postChat(
      "What is the latest market update?"
    );
    if (chatStatus !== 200 || typeof json.answer !== "string") {
      throw new Error(`Fallback check failed: ${chatStatus} ${JSON.stringify(json)}`);
    }
    console.log("Fallback response (first 200 chars):", json.answer.slice(0, 200));
  } else {
    console.log(
      "Missing-API-key check skipped. Restart the API without OPENAI_API_KEY and re-run to validate fallback."
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
