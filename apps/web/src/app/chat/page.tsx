"use client";
import { useState, useRef, useEffect, useMemo } from "react";
import { REGION_LIST, PORTFOLIOS, type AgentFeed } from "@proof/shared";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import rehypeExternalLinks from "rehype-external-links";

function SparklesIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
    </svg>
  );
}

const suggestedQuestions = [
  "Which suppliers should we pressure on lead-time concessions this quarter?",
  "Summarize ProofOfConceptStudio.com insights on category strategy for my portfolio.",
  "What cost drivers are most volatile right now, and how should we hedge?",
  "What negotiation levers should we use for a multi-year services contract?"
];

const focusChips = [
  "Negotiation plan",
  "Supplier risk",
  "Market pricing",
  "Commercial levers",
  "Stakeholder update"
];

type AgentSummary = {
  id: string;
  portfolio: string;
  label: string;
  description?: string;
  articlesPerRun: number;
  feedsByRegion: Record<string, AgentFeed[]>;
};

type AssistantStatus = {
  enabled: boolean;
  model?: string | null;
  runnerConfigured?: boolean;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: string[];
  status?: "loading" | "ready";
};

const buildMessageId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const extractSources = (content: string) => {
  const matches = content.match(/https?:\/\/[^\s)]+/g) ?? [];
  return Array.from(new Set(matches));
};

export default function ChatPage({
  searchParams
}: {
  searchParams?: { region?: string; portfolio?: string };
}) {
  const initialRegion =
    searchParams?.region && REGION_LIST.some((r) => r.slug === searchParams.region)
      ? searchParams.region
      : REGION_LIST[0].slug;
  const initialPortfolio =
    searchParams?.portfolio && PORTFOLIOS.some((p) => p.slug === searchParams.portfolio)
      ? searchParams.portfolio
      : PORTFOLIOS[0].slug;

  const [region, setRegion] = useState<string>(initialRegion);
  const [portfolio, setPortfolio] = useState<string>(initialPortfolio);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [assistantStatus, setAssistantStatus] = useState<AssistantStatus | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [messages, loading]);

  useEffect(() => {
    const loadAgents = async () => {
      try {
        const res = await fetch("/api/agents");
        const json = await res.json();
        setAgents(json.agents ?? []);
        setAgentError(null);
      } catch (err) {
        setAgentError("Unable to load agent catalog. Chat will use generic context.");
      }
    };
    loadAgents();
  }, []);

  useEffect(() => {
    const loadStatus = async () => {
      try {
        const res = await fetch("/api/chat", { method: "GET" });
        const json = await res.json();
        setAssistantStatus({
          enabled: Boolean(json.enabled),
          model: json.model ?? null,
          runnerConfigured: json.runnerConfigured ?? false
        });
      } catch (err) {
        setAssistantStatus({ enabled: false, model: null, runnerConfigured: false });
      }
    };
    loadStatus();
  }, []);

  const activeAgent = agents.find((a) => a.portfolio === portfolio);
  const regionFeeds = activeAgent?.feedsByRegion?.[region] ?? [];

  const assistantMessage = useMemo(
    () => [...messages].reverse().find((message) => message.role === "assistant" && message.content),
    [messages]
  );

  const displayedSources = assistantMessage?.sources ?? (assistantMessage ? extractSources(assistantMessage.content) : []);

  const ask = async () => {
    const trimmed = question.trim();
    if (!trimmed || loading) return;

    const userMessage: ChatMessage = {
      id: buildMessageId(),
      role: "user",
      content: trimmed
    };
    const assistantId = buildMessageId();

    setMessages((prev) => [
      ...prev,
      userMessage,
      { id: assistantId, role: "assistant", content: "", status: "loading" }
    ]);
    setQuestion("");
    setLoading(true);

    const history = [...messages, userMessage]
      .filter((message) => message.role === "user" || message.role === "assistant")
      .slice(-10)
      .map((message) => ({ role: message.role, content: message.content }));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed, region, portfolio, agentId: activeAgent?.id, messages: history })
      });
      const json = await res.json();
      const responseText = json.answer || json.error || "No response received";
      const sources = Array.isArray(json.sources) ? json.sources : extractSources(responseText);
      setMessages((prev) =>
        prev.map((message) =>
          message.id === assistantId
            ? { ...message, content: responseText, sources, status: "ready" }
            : message
        )
      );
    } catch (err) {
      setMessages((prev) =>
        prev.map((message) =>
          message.id === assistantId
            ? {
                ...message,
                content: "Failed to connect to the AI service. Please try again.",
                status: "ready"
              }
            : message
        )
      );
    }
    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      ask();
    }
  };

  const handleSuggestion = (q: string) => {
    setQuestion(q);
    inputRef.current?.focus();
  };

  const statusTone = assistantStatus ? (assistantStatus.enabled ? "live" : "offline") : "pending";
  const statusLabel = assistantStatus
    ? assistantStatus.enabled
      ? "AI online"
      : "Briefs-only"
    : "Checking AI";
  const statusBadgeClass = assistantStatus
    ? assistantStatus.enabled
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
      : "border-amber-500/30 bg-amber-500/10 text-amber-400"
    : "border-border bg-secondary text-muted-foreground";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <SparklesIcon />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">Category Management Chat</h1>
              <span
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${statusBadgeClass}`}
              >
                <span className={`status-dot ${statusTone}`} />
                <span>{statusLabel}</span>
                {assistantStatus?.enabled && assistantStatus.model && (
                  <span className="hidden sm:inline text-[10px] font-semibold uppercase tracking-wider">
                    {assistantStatus.model}
                  </span>
                )}
              </span>
            </div>
            <p className="mt-1 text-muted-foreground">
              A domain expert built for category strategy, negotiation prep, and supplier intelligence.
            </p>
            {assistantStatus && !assistantStatus.enabled && (
              <p className="mt-2 text-xs text-amber-500">
                Set OPENAI_API_KEY (and optional OPENAI_MODEL) on the API service to enable AI responses.
              </p>
            )}
            {assistantStatus && assistantStatus.runnerConfigured === false && (
              <p className="mt-1 text-xs text-amber-500">
                Set RUNNER_BASE_URL on the API service to load the agent catalog.
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-full border border-border bg-card px-3 py-1">ProofOfConceptStudio.com first</span>
          <span className="rounded-full border border-border bg-card px-3 py-1">Briefs + web search</span>
          <span className="rounded-full border border-border bg-card px-3 py-1">First-principles reasoning</span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-card shadow-sm">
            <div className="border-b border-border px-5 py-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">Chat Thread</p>
                <span className="text-xs text-muted-foreground">Live sourcing + negotiation support</span>
              </div>
            </div>
            <div ref={threadRef} className="max-h-[520px] space-y-4 overflow-y-auto px-5 py-4">
              {messages.length === 0 && (
                <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                  <p className="font-semibold text-foreground">Start with a sourcing objective.</p>
                  <p className="mt-1">
                    Ask for negotiation levers, supplier risk, or category intelligence. We will cite each source.
                  </p>
                </div>
              )}
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "border border-border bg-background text-foreground"
                    }`}
                  >
                    {message.role === "assistant" ? (
                      message.status === "loading" ? (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          <span>Building answer...</span>
                        </div>
                      ) : (
                        <div className="prose max-w-none text-sm dark:prose-invert">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            rehypePlugins={[
                              rehypeSanitize,
                              [rehypeExternalLinks, { target: "_blank", rel: ["noreferrer", "noopener"] }]
                            ]}
                          >
                            {message.content}
                          </ReactMarkdown>
                        </div>
                      )
                    ) : (
                      <p>{message.content}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {!messages.length && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Suggested Questions</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {suggestedQuestions.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => handleSuggestion(q)}
                    className="group flex items-start gap-3 rounded-lg border border-border bg-card p-3 text-left text-sm text-muted-foreground transition-all hover:border-primary/30 hover:bg-muted"
                  >
                    <span className="mt-0.5 text-muted-foreground transition-colors group-hover:text-primary">→</span>
                    <span className="text-foreground">{q}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-foreground">Ask the assistant</p>
                <p className="text-xs text-muted-foreground">Enter for send, Shift+Enter for new line.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {focusChips.map((chip) => (
                  <button
                    key={chip}
                    onClick={() => handleSuggestion(`${chip}: `)}
                    className="rounded-full border border-border bg-muted/50 px-3 py-1 text-xs text-muted-foreground transition hover:border-primary/30 hover:text-foreground"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
            <div className="relative">
              <textarea
                ref={inputRef}
                className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 pr-14 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                rows={4}
                placeholder="Ask a question about your category strategy..."
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <button
                onClick={ask}
                disabled={loading || !question.trim()}
                className="absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm transition-all hover:bg-primary/90 disabled:opacity-50"
              >
                {loading ? (
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <SendIcon />
                )}
              </button>
            </div>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Context</h3>
            <div className="mt-4 grid gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Region</label>
                <select value={region} onChange={(e) => setRegion(e.target.value)} className="w-full">
                  {REGION_LIST.map((r) => (
                    <option key={r.slug} value={r.slug}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Portfolio</label>
                <select value={portfolio} onChange={(e) => setPortfolio(e.target.value)} className="w-full">
                  {PORTFOLIOS.map((p) => (
                    <option key={p.slug} value={p.slug}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-5 rounded-xl border border-border bg-muted/20 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Assigned agent</p>
                  <p className="text-base font-semibold text-foreground">
                    {activeAgent?.label ?? "Loading agent..."}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {activeAgent?.description ?? "Each portfolio uses a dedicated agent trained on that category."}
                  </p>
                </div>
                <div className="rounded-lg bg-background px-3 py-2 text-center border border-border">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Articles/run</p>
                  <p className="text-lg font-semibold text-foreground">{activeAgent?.articlesPerRun ?? 3}</p>
                </div>
              </div>
              {agentError && <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">{agentError}</p>}
            </div>
            {regionFeeds.length > 0 && (
              <div className="mt-4 text-sm text-muted-foreground">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide">Daily sources ({regionFeeds.length})</p>
                <div className="grid gap-2">
                  {regionFeeds.slice(0, 5).map((feed) => (
                    <div
                      key={`${feed.url}-${feed.name}`}
                      className="flex items-center gap-2 rounded-md bg-background px-2 py-1.5 border border-border"
                    >
                      <span className="text-muted-foreground">•</span>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">{feed.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{feed.url}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Source ladder</h3>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2">
                <span className="font-medium text-foreground">ProofOfConceptStudio.com</span>
                <span className="text-xs text-muted-foreground">Primary</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2">
                <span className="font-medium text-foreground">Daily briefs</span>
                <span className="text-xs text-muted-foreground">Secondary</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2">
                <span className="font-medium text-foreground">Web search</span>
                <span className="text-xs text-muted-foreground">Tertiary</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Latest citations</h3>
            {displayedSources.length ? (
              <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                {displayedSources.slice(0, 6).map((source) => (
                  <div key={source} className="rounded-lg border border-border bg-muted/20 px-3 py-2">
                    <p className="truncate text-foreground">{source}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                Citations will appear here once the assistant responds with sources.
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
