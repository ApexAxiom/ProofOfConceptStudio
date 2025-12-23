"use client";
import { useState } from "react";
import { REGION_LIST, PORTFOLIOS } from "@proof/shared";

export default function AdminPage() {
  const [runWindow, setRunWindow] = useState("am");
  const [region, setRegion] = useState(REGION_LIST[0].slug);
  const [agentId, setAgentId] = useState("");
  const [message, setMessage] = useState("");

  const trigger = async () => {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001"}/admin/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-token": process.env.NEXT_PUBLIC_ADMIN_TOKEN ?? ""
      },
      body: JSON.stringify({ runWindow, region, agentId: agentId || undefined })
    });
    const json = await res.json();
    setMessage(JSON.stringify(json));
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Admin: Trigger Run</h2>
      <div className="flex gap-2 items-center">
        <label>Run Window</label>
        <select value={runWindow} onChange={(e) => setRunWindow(e.target.value)} className="border px-2 py-1">
          <option value="am">AM</option>
          <option value="pm">PM</option>
        </select>
        <label>Region</label>
        <select value={region} onChange={(e) => setRegion(e.target.value)} className="border px-2 py-1">
          {REGION_LIST.map((r) => (
            <option key={r.slug} value={r.slug}>
              {r.label}
            </option>
          ))}
        </select>
        <label>Portfolio</label>
        <select value={agentId} onChange={(e) => setAgentId(e.target.value)} className="border px-2 py-1">
          <option value="">All</option>
          {PORTFOLIOS.map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.label}
            </option>
          ))}
        </select>
        <button onClick={trigger} className="bg-blue-600 text-white px-3 py-1 rounded">
          Run now
        </button>
      </div>
      {message && <pre className="bg-gray-100 p-2 text-sm">{message}</pre>}
    </div>
  );
}
