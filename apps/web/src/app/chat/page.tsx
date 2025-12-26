"use client";
import { useState, useRef, useEffect } from "react";
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
  "What are the key market drivers for drilling services this week?",
  "Summarize recent cybersecurity advisories affecting our region",
  "What freight rate trends should we watch?",
  "Any major project announcements in subsea/offshore?"
];

type AgentSummary = {
  id: string;
  portfolio: string;
  label: string;
  description?: string;
  articlesPerRun: number;
  feedsByRegion: Record<string, AgentFeed[]>;
};

export default function ChatPage() {
  const [region, setRegion] = useState<string>(REGION_LIST[0].slug);
  const [portfolio, setPortfolio] = useState<string>(PORTFOLIOS[0].slug);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [agentError, setAgentError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const answerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (answer && answerRef.current) {
      answerRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [answer]);

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

  const activeAgent = agents.find((a) => a.portfolio === portfolio);
  const regionFeeds = activeAgent?.feedsByRegion?.[region] ?? [];

  const ask = async () => {
    if (!question.trim()) return;
    setLoading(true);
    setAnswer("");
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, region, portfolio, agentId: activeAgent?.id })
      });
      const json = await res.json();
      setAnswer(json.answer || json.error || "No response received");
    } catch (err) {
      setAnswer("Failed to connect to the AI service. Please try again.");
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

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <SparklesIcon />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">AI Category Assistant</h1>
          <p className="mt-1 text-muted-foreground">
            Ask questions about market intelligence, supplier trends, or any category-related topic.
          </p>
        </div>
      </div>

      {/* Context Selectors */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Context</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Region</label>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="w-full"
            >
              {REGION_LIST.map((r) => (
                <option key={r.slug} value={r.slug}>{r.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Portfolio</label>
            <select
              value={portfolio}
              onChange={(e) => setPortfolio(e.target.value)}
              className="w-full"
            >
              {PORTFOLIOS.map((p) => (
                <option key={p.slug} value={p.slug}>{p.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-5 rounded-lg border border-border bg-muted/30 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Assigned agent</p>
              <p className="text-base font-semibold text-foreground">{activeAgent?.label ?? "Loading agent..."}</p>
              <p className="text-sm text-muted-foreground">{activeAgent?.description ?? "Each portfolio uses a dedicated agent trained on that category."}</p>
            </div>
            <div className="rounded-lg bg-background px-3 py-2 text-center border border-border">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Articles/run</p>
              <p className="text-lg font-semibold text-foreground">{activeAgent?.articlesPerRun ?? 3}</p>
            </div>
          </div>
          {agentError && <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">{agentError}</p>}
          {regionFeeds.length > 0 && (
            <div className="mt-3 text-sm text-muted-foreground">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide">Daily sources ({regionFeeds.length})</p>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {regionFeeds.slice(0, 6).map((feed) => (
                  <div key={`${feed.url}-${feed.name}`} className="flex items-center gap-2 rounded-md bg-background px-2 py-1.5 border border-border">
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
      </div>

      {/* Suggested Questions */}
      {!answer && (
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

      {/* Input */}
      <div className="relative">
        <div className="relative overflow-hidden rounded-xl border border-border bg-card shadow-sm focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
          <textarea
            ref={inputRef}
            className="w-full resize-none border-0 bg-transparent px-4 py-3 pr-14 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-0"
            rows={3}
            placeholder="Ask a question about your category..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            onClick={ask}
            disabled={loading || !question.trim()}
            className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm transition-all hover:bg-primary/90 disabled:opacity-50"
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
        <p className="mt-2 text-xs text-muted-foreground">Press Enter to send, Shift+Enter for new line</p>
      </div>

      {/* Answer */}
      {(answer || loading) && (
        <div ref={answerRef} className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <SparklesIcon />
            </div>
            <span className="font-semibold text-foreground">AI Response</span>
            {loading && (
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Thinking...
              </span>
            )}
          </div>
          
          {answer && (
            <div className="prose max-w-none dark:prose-invert">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[
                  rehypeSanitize,
                  [rehypeExternalLinks, { target: "_blank", rel: ["noreferrer", "noopener"] }]
                ]}
              >
                {answer}
              </ReactMarkdown>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
