"use client";
import { useState } from "react";
import { REGION_LIST, PORTFOLIOS } from "@proof/shared";

interface FeedHealthEntry {
  url: string;
  name: string;
  lastRegion: "au" | "us-mx-la-lng";
  lastStatus: "ok" | "empty" | "error";
  lastCheckedAt: string;
  consecutiveFailures: number;
  consecutiveEmpty: number;
}

function TerminalIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
    </svg>
  );
}

/**
 * Admin console for manual intelligence runs.
 */
export default function AdminPage() {
  const [runWindow, setRunWindow] = useState("apac");
  const [region, setRegion] = useState<string>(REGION_LIST[0].slug);
  const [agentId, setAgentId] = useState("");
  const [adminToken, setAdminToken] = useState("");
  const [message, setMessage] = useState("");
  const [feedHealth, setFeedHealth] = useState<FeedHealthEntry[]>([]);
  const [feedHealthUpdatedAt, setFeedHealthUpdatedAt] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const runRequest = async (payload: {
    runWindow: string;
    region: string;
    agentId?: string;
  }) => {
    const res = await fetch("/api/admin/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, adminToken })
    });
    const json = await res.json();
    return { status: res.status, data: json, runWindow: payload.runWindow };
  };

  const trigger = async () => {
    setLoading(true);
    setMessage("");
    try {
      const result = await runRequest({
        runWindow,
        region,
        agentId: agentId || undefined
      });
      setMessage(JSON.stringify(result, null, 2));
    } catch (err) {
      setMessage("Failed to trigger run. Check console for details.");
    }
    setLoading(false);
  };

  const triggerAll = async () => {
    setLoading(true);
    setMessage("");
    try {
      const results = [];
      for (const window of ["apac", "international"]) {
        const result = await runRequest({
          runWindow: window,
          region,
          agentId: agentId || undefined
        });
        results.push(result);
      }
      setMessage(JSON.stringify({ results }, null, 2));
    } catch (err) {
      setMessage("Failed to trigger run. Check console for details.");
    }
    setLoading(false);
  };

  const loadFeedHealth = async () => {
    if (!adminToken) return;
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/feed-health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminToken, limit: 50 })
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage(JSON.stringify(json, null, 2));
        return;
      }
      setFeedHealth(Array.isArray(json.entries) ? json.entries : []);
      setFeedHealthUpdatedAt(typeof json.updatedAt === "string" ? json.updatedAt : "");
    } catch (err) {
      setMessage("Failed to load feed health.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 shadow-sm">
          <TerminalIcon />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Admin Console</h1>
          <p className="mt-1 text-muted-foreground">
            Manually trigger intelligence runs or manage system operations.
          </p>
        </div>
      </div>

      {/* Run Trigger Form */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
            <PlayIcon />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Trigger Intelligence Run</h3>
            <p className="text-sm text-muted-foreground">Execute a manual run for specific region and portfolio</p>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Run Window</label>
            <select
              value={runWindow}
              onChange={(e) => setRunWindow(e.target.value)}
              className="w-full"
            >
              <option value="apac">APAC (06:00 AWST)</option>
              <option value="international">International (06:00 CST)</option>
            </select>
          </div>

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
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              className="w-full"
            >
              <option value="">All Portfolios</option>
              {PORTFOLIOS.map((p) => (
                <option key={p.slug} value={p.slug}>{p.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Admin Token</label>
            <input
              type="password"
              value={adminToken}
              onChange={(e) => setAdminToken(e.target.value)}
              className="w-full"
              placeholder="Enter your admin token"
            />
          </div>
        </div>

        <div className="mt-5 flex items-center gap-4">
          <button
            onClick={trigger}
            disabled={loading || !adminToken}
            className="btn-primary"
          >
            {loading ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Running...
              </>
            ) : (
              <>
                <PlayIcon />
                Execute Run
              </>
            )}
          </button>
          <button
            onClick={triggerAll}
            disabled={loading || !adminToken}
            className="btn-secondary"
          >
            {loading ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Running...
              </>
            ) : (
              <>
                <PlayIcon />
                Run All Windows
              </>
            )}
          </button>
          <button
            onClick={loadFeedHealth}
            disabled={loading || !adminToken}
            className="btn-secondary"
          >
            Load Feed Health
          </button>
          <span className="text-sm text-muted-foreground">
            {!adminToken && "Enter admin token to enable"}
          </span>
        </div>
      </div>

      {/* Feed health */}
      {feedHealth.length > 0 ? (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Feed health</h3>
            <p className="text-xs text-muted-foreground">
              Updated: {feedHealthUpdatedAt ? new Date(feedHealthUpdatedAt).toLocaleString("en-US") : "n/a"}
            </p>
          </div>
          <div className="space-y-2">
            {feedHealth.slice(0, 15).map((entry) => (
              <div key={entry.url} className="rounded-lg border border-border bg-background p-3 text-sm">
                <p className="font-semibold text-foreground line-clamp-1">{entry.name}</p>
                <p className="mt-1 text-xs text-muted-foreground line-clamp-1">{entry.url}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>Status: {entry.lastStatus}</span>
                  <span>Region: {entry.lastRegion === "au" ? "APAC" : "INTL"}</span>
                  <span>Empty streak: {entry.consecutiveEmpty}</span>
                  <span>Failure streak: {entry.consecutiveFailures}</span>
                  <span>Last check: {new Date(entry.lastCheckedAt).toLocaleString("en-US")}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Output */}
      {message && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
            </svg>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Response</h4>
          </div>
          <pre className="overflow-x-auto rounded-lg bg-muted p-4 font-mono text-sm text-foreground">
            {message}
          </pre>
        </div>
      )}

      {/* Info */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <div className="text-sm">
            <p className="font-semibold text-amber-800 dark:text-amber-300">Security Notice</p>
            <p className="mt-1 text-amber-700 dark:text-amber-400/80">
              This admin console requires proper authentication. Runs are logged and audited. 
              Contact your administrator if you need an access token.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
