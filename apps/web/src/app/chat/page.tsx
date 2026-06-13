"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { REGION_LIST, PORTFOLIOS, type AgentFeed } from "@proof/shared";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import rehypeExternalLinks from "rehype-external-links";

function SparklesIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a2.25 2.25 0 002.456 2.456L21.75 6l-1.035.259a2.25 2.25 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
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

function StopIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="6" width="12" height="12" rx="2" />
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
  region: string;
  portfolio: string;
  label: string;
  description?: string;
  articlesPerRun: number;
  feeds?: AgentFeed[];
};

type AssistantStatus = {
  enabled: boolean;
  model?: string | null;
  runnerConfigured?: boolean;
  reachable?: boolean;
  error?: string | null;
};

type ChatCitation = {
  sourceId: string;
  url: string;
  title?: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "context";
  content: string;
  sources?: string[];
  citations?: ChatCitation[];
  status?: "loading" | "ready";
  error?: boolean;
  retryQuestion?: string;
};

const CHAT_STORAGE_KEY = "pocs-chat-thread-v1";

type BriefSummary = {
  postId: string;
  title: string;
  publishedAt: string;
  region: string;
};

type AuthStateResponse = {
  authenticated?: boolean;
};

const buildMessageId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const extractSources = (content: string) => {
  const matches = content.match(/https?:\/\/[^\s)]+/g) ?? [];
  return Array.from(new Set(matches));
};

function ThinkingIndicator({ contextLabel }: { contextLabel: string }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setElapsed((seconds) => seconds + 1), 1000);
    return () => clearInterval(timer);
  }, []);
  const phrases = [
    `Reviewing the latest ${contextLabel} intelligence...`,
    "Scanning market and supplier signals...",
    "Weighing the commercial implications...",
    "Drafting a recommendation..."
  ];
  const phrase = phrases[Math.min(Math.floor(elapsed / 4), phrases.length - 1)];
  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      <span>{phrase}</span>
      {elapsed >= 4 && <span className="text-xs opacity-70">{elapsed}s</span>}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          // Clipboard unavailable (e.g. insecure context); ignore.
        }
      }}
      className="text-[10px] font-medium text-muted-foreground transition hover:text-foreground"
      title="Copy answer"
    >
      {copied ? "Copied ✓" : "Copy"}
    </button>
  );
}

function ChatThread({
  messages,
  threadRef,
  contextLabel,
  onRetry,
  onNewChat
}: {
  messages: ChatMessage[];
  threadRef: React.RefObject<HTMLDivElement>;
  contextLabel: string;
  onRetry: (messageId: string) => void;
  onNewChat: () => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm">
      <div className="border-b border-border px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-foreground">Chat Thread</p>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-muted-foreground sm:inline">Live sourcing + negotiation support</span>
            {messages.length > 0 && (
              <button
                onClick={onNewChat}
                className="rounded-full border border-border bg-muted/50 px-3 py-1 text-xs text-muted-foreground transition hover:border-primary/30 hover:text-foreground"
              >
                New chat
              </button>
            )}
          </div>
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
        {messages.map((message) =>
          message.role === "context" ? (
            <div key={message.id} className="flex items-center gap-3 py-1" role="separator">
              <span className="h-px flex-1 bg-border" />
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{message.content}</span>
              <span className="h-px flex-1 bg-border" />
            </div>
          ) : (
            <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-background text-foreground"
                }`}
              >
                {message.role === "assistant" ? (
                  message.status === "loading" ? (
                    <ThinkingIndicator contextLabel={contextLabel} />
                  ) : (
                    <div className="space-y-3">
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
                      {message.citations && message.citations.length > 0 && (
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          {message.citations.map((citation) => (
                            <a
                              key={citation.sourceId}
                              href={citation.url}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-1 text-[10px] text-foreground hover:border-primary/40 hover:text-primary"
                            >
                              <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
                              {citation.title ?? citation.url}
                            </a>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-3">
                        {message.error && message.retryQuestion ? (
                          <button
                            onClick={() => onRetry(message.id)}
                            className="rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-medium text-foreground transition hover:border-primary/40 hover:text-primary"
                          >
                            Retry
                          </button>
                        ) : (
                          message.content && <CopyButton text={message.content} />
                        )}
                      </div>
                    </div>
                  )
                ) : (
                  <p>{message.content}</p>
                )}
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}

function ChatComposer({
  question,
  setQuestion,
  loading,
  onSend,
  onStop,
  onKeyDown,
  onSuggestion,
  inputRef
}: {
  question: string;
  setQuestion: (value: string) => void;
  loading: boolean;
  onSend: () => void;
  onStop: () => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
  onSuggestion: (value: string) => void;
  inputRef: React.RefObject<HTMLTextAreaElement>;
}) {
  return (
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
              onClick={() => onSuggestion(`${chip}: `)}
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
          onKeyDown={onKeyDown}
        />
        <button
          onClick={() => (loading ? onStop() : onSend())}
          disabled={!loading && !question.trim()}
          title={loading ? "Stop response" : "Send"}
          className="absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm transition-all hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? <StopIcon /> : <SendIcon />}
        </button>
      </div>
    </div>
  );
}

function AgentContextPanel({
  region,
  portfolio,
  setRegion,
  setPortfolio,
  latestBriefs,
  regionFeeds,
  agentError,
  activeBriefId
}: {
  region: string;
  portfolio: string;
  setRegion: (value: string) => void;
  setPortfolio: (value: string) => void;
  latestBriefs: BriefSummary[];
  regionFeeds: AgentFeed[];
  agentError: string | null;
  activeBriefId?: string;
}) {
  return (
    <aside className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Context</h3>
        <div className="mt-4 grid gap-4">
          <div className="space-y-2">
            <label htmlFor="region-select" className="text-sm font-medium text-foreground">
              Region
            </label>
            <select
              id="region-select"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              {REGION_LIST.map((r) => (
                <option key={r.slug} value={r.slug}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label htmlFor="portfolio-select" className="text-sm font-medium text-foreground">
              Portfolio Agent
            </label>
            <select
              id="portfolio-select"
              value={portfolio}
              onChange={(e) => setPortfolio(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              {PORTFOLIOS.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        {activeBriefId && (
          <p className="mt-4 text-xs text-primary">
            Brief-scoped: {activeBriefId}
          </p>
        )}
        <div className="mt-5 rounded-xl border border-border bg-muted/20 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Briefs in context
          </p>
          {latestBriefs.length > 0 ? (
            <div className="space-y-2">
              {latestBriefs.map((brief) => (
                <Link
                  key={brief.postId}
                  href={`/brief/${encodeURIComponent(brief.postId)}`}
                  className="block rounded-lg border border-border bg-background px-3 py-2 transition hover:border-primary/40"
                >
                  <p className="text-sm font-medium text-foreground line-clamp-2">{brief.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {brief.region === "au" ? "APAC" : "INTL"} · {new Date(brief.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No published brief is available yet for this portfolio in this cycle.</p>
          )}
          {agentError && <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">{agentError}</p>}
        </div>
        {regionFeeds.length > 0 && (
          <div className="mt-4 text-sm text-muted-foreground">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide">Briefing sources ({regionFeeds.length})</p>
            <div className="grid gap-2">
              {regionFeeds.slice(0, 5).map((feed) => (
                <div
                  key={`${feed.url}-${feed.name}`}
                  className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5"
                >
                  <span className="text-muted-foreground">•</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">{feed.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{feed.url}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

/**
 * Category management assistant chat experience.
 */
export default function ChatPage({
  searchParams
}: {
  searchParams?: { region?: string; portfolio?: string; briefId?: string };
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
  const initialBriefId = searchParams?.briefId;
  const [activeBriefId, setActiveBriefId] = useState<string | undefined>(initialBriefId);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [assistantStatus, setAssistantStatus] = useState<AssistantStatus | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [latestBriefs, setLatestBriefs] = useState<BriefSummary[]>([]);
  const [authReady, setAuthReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const initialSelectionRef = useRef({ region: initialRegion, portfolio: initialPortfolio });
  const abortRef = useRef<AbortController | null>(null);
  const contextInitRef = useRef(false);

  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // Restore the thread from this browser session so navigation/refresh does not wipe the chat.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(CHAT_STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as { messages?: ChatMessage[] };
      const restored = (saved.messages ?? []).filter(
        (message) => message && typeof message.content === "string" && message.status !== "loading"
      );
      if (restored.length) setMessages(restored);
    } catch {
      // Corrupt or unavailable session storage; start fresh.
    }
  }, []);

  useEffect(() => {
    try {
      if (!messages.length) {
        sessionStorage.removeItem(CHAT_STORAGE_KEY);
      } else if (!messages.some((message) => message.status === "loading")) {
        sessionStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify({ messages: messages.slice(-40) }));
      }
    } catch {
      // Session storage unavailable; persistence is best-effort.
    }
  }, [messages]);

  // Mark mid-thread context switches so answers before/after are clearly scoped.
  useEffect(() => {
    if (!contextInitRef.current) {
      contextInitRef.current = true;
      return;
    }
    const portfolioName = PORTFOLIOS.find((p) => p.slug === portfolio)?.label ?? portfolio;
    const regionName = REGION_LIST.find((r) => r.slug === region)?.label ?? region;
    const note = `Context switched to ${portfolioName} · ${regionName}`;
    setMessages((prev) => {
      if (!prev.length) return prev;
      const last = prev[prev.length - 1];
      if (last?.role === "context") {
        return [...prev.slice(0, -1), { ...last, content: note }];
      }
      return [...prev, { id: buildMessageId(), role: "context", content: note }];
    });
  }, [region, portfolio]);

  useEffect(() => {
    if (!initialBriefId) return;
    const initialSelection = initialSelectionRef.current;
    if (region !== initialSelection.region || portfolio !== initialSelection.portfolio) {
      if (activeBriefId !== undefined) {
        setActiveBriefId(undefined);
      }
      return;
    }
    if (activeBriefId !== initialBriefId) {
      setActiveBriefId(initialBriefId);
    }
  }, [region, portfolio, initialBriefId, activeBriefId]);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch("/api/chat-access", { cache: "no-store" });
        if (!res.ok) {
          setAuthenticated(false);
          return;
        }
        const json = (await res.json()) as AuthStateResponse;
        setAuthenticated(Boolean(json.authenticated));
      } catch {
        setAuthenticated(false);
      } finally {
        setAuthReady(true);
      }
    };
    checkAuth();
  }, []);

  useEffect(() => {
    if (!authenticated) return;
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
  }, [authenticated]);

  useEffect(() => {
    if (!authenticated) return;
    const loadBriefs = async () => {
      try {
        const query = new URLSearchParams({ region, portfolio, limit: "3" });
        const res = await fetch(`/api/posts?${query.toString()}`);
        if (res.ok) {
          const briefs = await res.json();
          setLatestBriefs(
            briefs.slice(0, 3).map((b: { postId: string; title: string; publishedAt: string; region: string }) => ({
              postId: b.postId,
              title: b.title,
              publishedAt: b.publishedAt,
              region: b.region
            }))
          );
        } else {
          setLatestBriefs([]);
        }
      } catch {
        setLatestBriefs([]);
      }
    };
    loadBriefs();
  }, [authenticated, region, portfolio]);

  useEffect(() => {
    if (!authenticated) return;
    const loadStatus = async () => {
      try {
        const res = await fetch("/api/chat", { method: "GET" });
        const json = await res.json();
        setAssistantStatus({
          enabled: Boolean(json.enabled),
          model: json.model ?? null,
          runnerConfigured: json.runnerConfigured ?? false,
          reachable: typeof json.reachable === "boolean" ? json.reachable : undefined,
          error: json.error ?? null
        });
      } catch (err) {
        setAssistantStatus({ enabled: false, model: null, runnerConfigured: false, reachable: false, error: "unavailable" });
      }
    };
    loadStatus();
  }, [authenticated]);

  useEffect(() => {
    if (!agents.length) return;
    const match = agents.find((agent) => agent.region === region && agent.portfolio === portfolio);
    if (!match) {
      const fallback = agents.find((agent) => agent.region === region);
      if (fallback) {
        setPortfolio(fallback.portfolio);
      }
    }
  }, [agents, region, portfolio]);

  const activeAgent = agents.find((a) => a.portfolio === portfolio && a.region === region);
  const regionFeeds = activeAgent?.feeds ?? [];
  const activePortfolioLabel = PORTFOLIOS.find((p) => p.slug === portfolio)?.label ?? portfolio;

  const runQuestion = async (trimmed: string, assistantId: string, historySource: ChatMessage[]) => {
    setLoading(true);

    const history = historySource
      .filter(
        (message) =>
          (message.role === "user" || message.role === "assistant") &&
          !message.error &&
          message.status !== "loading" &&
          message.content.trim().length > 0
      )
      .slice(-10)
      .map((message) => ({ role: message.role, content: message.content }));

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: trimmed,
          region,
          portfolio,
          agentId: activeAgent?.id,
          briefId: activeBriefId,
          messages: history
        }),
        signal: controller.signal
      });
      const json = await res.json();
      const responseText = json.answer || json.error || "No response received";
      const failed = !res.ok && !json.answer;
      const sources = Array.isArray(json.sources) ? json.sources : extractSources(responseText);
      const citations = Array.isArray(json.citations) ? json.citations : [];
      setMessages((prev) =>
        prev.map((message) =>
          message.id === assistantId
            ? {
                ...message,
                content: responseText,
                sources,
                citations,
                status: "ready",
                error: failed || undefined,
                retryQuestion: failed ? trimmed : undefined
              }
            : message
        )
      );
    } catch (err) {
      const stopped = (err as Error)?.name === "AbortError";
      setMessages((prev) =>
        prev.map((message) =>
          message.id === assistantId
            ? {
                ...message,
                content: stopped
                  ? "Response stopped."
                  : "Failed to connect to the AI service. Please try again.",
                status: "ready",
                error: true,
                retryQuestion: trimmed
              }
            : message
        )
      );
    } finally {
      abortRef.current = null;
      setLoading(false);
    }
  };

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
    await runQuestion(trimmed, assistantId, [...messages, userMessage]);
  };

  const retry = async (assistantId: string) => {
    if (loading) return;
    const index = messages.findIndex((message) => message.id === assistantId);
    const trimmed = messages[index]?.retryQuestion?.trim();
    if (index < 0 || !trimmed) return;

    setMessages((prev) =>
      prev.map((message) =>
        message.id === assistantId
          ? { ...message, content: "", status: "loading", error: undefined }
          : message
      )
    );
    await runQuestion(trimmed, assistantId, messages.slice(0, index));
  };

  const stopResponse = () => {
    abortRef.current?.abort();
  };

  const startNewChat = () => {
    abortRef.current?.abort();
    setMessages([]);
    try {
      sessionStorage.removeItem(CHAT_STORAGE_KEY);
    } catch {
      // Best-effort cleanup.
    }
    inputRef.current?.focus();
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

  const handleLogin = async () => {
    if (!loginUsername.trim() || !loginPassword) {
      setLoginError("Enter your credentials to continue.");
      return;
    }

    setLoginLoading(true);
    setLoginError(null);
    try {
      const res = await fetch("/api/chat-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: loginUsername.trim(), password: loginPassword })
      });
      if (!res.ok) {
        setLoginError("Invalid credentials.");
        return;
      }
      setAuthenticated(true);
      setLoginPassword("");
    } catch {
      setLoginError("Login is temporarily unavailable.");
    } finally {
      setLoginLoading(false);
    }
  };

  const isLive = Boolean(assistantStatus?.enabled) && assistantStatus?.reachable !== false;
  const statusTone = assistantStatus ? (isLive ? "live" : "offline") : "pending";
  const statusLabel = assistantStatus
    ? assistantStatus.enabled
      ? assistantStatus.reachable === false
        ? "AI offline"
        : "AI online"
      : "Briefs-only"
    : "Checking AI";
  const statusBadgeClass = assistantStatus
    ? isLive
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
      : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
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
              <h1 className="text-2xl font-semibold text-foreground">Category Management Chat</h1>
              <span
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${statusBadgeClass}`}
              >
                <span className={`status-dot ${statusTone}`} />
                <span>{statusLabel}</span>
              </span>
              {activeBriefId && (
                <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  Brief-scoped
                </span>
              )}
            </div>
            <p className="mt-1 text-muted-foreground">
              A domain expert built for category strategy, negotiation prep, and supplier intelligence.
            </p>
            {assistantStatus && !assistantStatus.enabled && (
              <p className="mt-2 text-xs text-amber-500">
                Set OPENAI_API_KEY (and optional OPENAI_MODEL) on the Amplify app to enable AI responses.
              </p>
            )}
            {assistantStatus && assistantStatus.enabled && assistantStatus.reachable === false && (
              <p className="mt-2 text-xs text-amber-500">
                AI connection check failed. Verify OPENAI_API_KEY/model access and outbound internet for the Amplify runtime.
                {assistantStatus.error ? ` (${assistantStatus.error})` : ""}
              </p>
            )}
            {assistantStatus && assistantStatus.runnerConfigured === false && (
              <p className="mt-1 text-xs text-amber-500">
                Agent catalog is unavailable in this deployment.
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-full border border-border bg-card px-3 py-1">ProofOfConceptStudio.com first</span>
          <span className="rounded-full border border-border bg-card px-3 py-1">Briefs + web search</span>
          <span className="rounded-full border border-border bg-card px-3 py-1">First-principles reasoning</span>
          {assistantStatus?.model && (
            <span className="rounded-full border border-border bg-card px-3 py-1" title={assistantStatus.model}>
              Model: {assistantStatus.model.replace(/-\d{4}-\d{2}-\d{2}$/, "")}
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <ChatThread
            messages={messages}
            threadRef={threadRef}
            contextLabel={activePortfolioLabel}
            onRetry={retry}
            onNewChat={startNewChat}
          />

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

          <ChatComposer
            question={question}
            setQuestion={setQuestion}
            loading={loading}
            onSend={ask}
            onStop={stopResponse}
            onKeyDown={handleKeyDown}
            onSuggestion={handleSuggestion}
            inputRef={inputRef}
          />
        </div>

        <AgentContextPanel
          region={region}
          portfolio={portfolio}
          setRegion={setRegion}
          setPortfolio={setPortfolio}
          latestBriefs={latestBriefs}
          regionFeeds={regionFeeds}
          agentError={agentError}
          activeBriefId={activeBriefId}
        />
      </div>

      {authReady && !authenticated && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
            <h2 className="text-xl font-semibold text-foreground">Admin Login Required</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Please log in with your admin account before using the AI assistant.
            </p>
            <div className="mt-5 space-y-3">
              <label className="block text-sm font-medium text-foreground">
                Username
                <input
                  type="text"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
                  autoComplete="username"
                />
              </label>
              <label className="block text-sm font-medium text-foreground">
                Password
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
                  autoComplete="current-password"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleLogin();
                    }
                  }}
                />
              </label>
              {loginError && <p className="text-sm text-red-500">{loginError}</p>}
              <button
                onClick={handleLogin}
                disabled={loginLoading}
                className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
              >
                {loginLoading ? "Signing in..." : "Sign in"}
              </button>
              <p className="text-center text-xs text-muted-foreground">
                If you want access the AI functionality, please contact: Roeland Westra
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
