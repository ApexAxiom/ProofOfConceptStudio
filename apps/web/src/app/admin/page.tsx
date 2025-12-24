"use client";
import { useState } from "react";
import { REGION_LIST, PORTFOLIOS } from "@proof/shared";

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

export default function AdminPage() {
  const [runWindow, setRunWindow] = useState("am");
  const [region, setRegion] = useState<string>(REGION_LIST[0].slug);
  const [agentId, setAgentId] = useState("");
  const [adminToken, setAdminToken] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const trigger = async () => {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runWindow, region, agentId: agentId || undefined, adminToken })
      });
      const json = await res.json();
      setMessage(JSON.stringify(json, null, 2));
    } catch (err) {
      setMessage("Failed to trigger run. Check console for details.");
    }
    setLoading(false);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-700/50 bg-gradient-to-br from-slate-900 via-slate-800/80 to-slate-900 p-8 shadow-xl">
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 via-orange-500/5 to-red-500/5" />
        <div className="absolute -right-20 -top-20 h-60 w-60 rounded-full bg-amber-500/10 blur-3xl" />
        
        <div className="relative flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/25">
            <TerminalIcon />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white md:text-3xl">Admin Console</h1>
            <p className="mt-2 text-base text-slate-300">
              Manually trigger intelligence runs or manage system operations. Requires admin token for authentication.
            </p>
          </div>
        </div>
      </div>

      {/* Run Trigger Form */}
      <div className="rounded-2xl border border-slate-700/50 bg-slate-900/50 p-6">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
            <PlayIcon />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Trigger Intelligence Run</h3>
            <p className="text-sm text-slate-400">Execute a manual run for specific region and portfolio</p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Run Window</label>
            <select
              value={runWindow}
              onChange={(e) => setRunWindow(e.target.value)}
              className="w-full"
            >
              <option value="am">AM (Morning)</option>
              <option value="pm">PM (Evening)</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Region</label>
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
            <label className="text-sm font-medium text-slate-300">Portfolio</label>
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
            <label className="text-sm font-medium text-slate-300">Admin Token</label>
            <input
              type="password"
              value={adminToken}
              onChange={(e) => setAdminToken(e.target.value)}
              className="w-full"
              placeholder="Enter your admin token"
            />
          </div>
        </div>

        <div className="mt-6 flex items-center gap-4">
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
          <span className="text-sm text-slate-500">
            {!adminToken && "Enter admin token to enable"}
          </span>
        </div>
      </div>

      {/* Output */}
      {message && (
        <div className="rounded-2xl border border-slate-700/50 bg-slate-900/50 p-6">
          <div className="mb-4 flex items-center gap-2">
            <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
            </svg>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Response</h4>
          </div>
          <pre className="overflow-x-auto rounded-xl bg-slate-800/80 p-4 font-mono text-sm text-slate-300">
            {message}
          </pre>
        </div>
      )}

      {/* Info */}
      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
        <div className="flex gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <div className="text-sm">
            <p className="font-semibold text-amber-300">Security Notice</p>
            <p className="mt-1 text-amber-200/70">
              This admin console requires proper authentication. Runs are logged and audited. 
              Contact your administrator if you need an access token.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
