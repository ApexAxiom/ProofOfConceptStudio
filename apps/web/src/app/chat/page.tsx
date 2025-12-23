"use client";
import { useState } from "react";
import { REGION_LIST, PORTFOLIOS } from "@proof/shared";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import rehypeExternalLinks from "rehype-external-links";

export default function ChatPage() {
  const [region, setRegion] = useState(REGION_LIST[0].slug);
  const [portfolio, setPortfolio] = useState(PORTFOLIOS[0].slug);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);

  const ask = async () => {
    setLoading(true);
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, region, portfolio })
    });
    const json = await res.json();
    setAnswer(json.answer);
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Category Bot</h2>
      <div className="flex gap-2 items-center">
        <select value={region} onChange={(e) => setRegion(e.target.value)} className="border px-2 py-1">
          {REGION_LIST.map((r) => (
            <option key={r.slug} value={r.slug}>
              {r.label}
            </option>
          ))}
        </select>
        <select value={portfolio} onChange={(e) => setPortfolio(e.target.value)} className="border px-2 py-1">
          {PORTFOLIOS.map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
      <textarea
        className="w-full border p-2"
        rows={4}
        placeholder="Ask a question"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
      />
      <button onClick={ask} disabled={loading} className="bg-blue-600 text-white px-3 py-1 rounded">
        {loading ? "Thinking..." : "Ask"}
      </button>
      {answer && (
        <ReactMarkdown
          className="prose max-w-none"
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[
            rehypeSanitize,
            [
              rehypeExternalLinks,
              {
                target: "_blank",
                rel: ["noreferrer", "noopener"]
              }
            ]
          ]}
        >
          {answer}
        </ReactMarkdown>
      )}
    </div>
  );
}
