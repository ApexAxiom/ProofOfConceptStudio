"use client";

import { useState } from "react";

/**
 * Copy a list of actions to the clipboard for quick reuse.
 */
export function CopyActionsButton({ actions }: { actions: string[] }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!actions.length) return;
    const text = actions.map((action) => `• ${action}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button type="button" onClick={handleCopy} className="btn-primary text-sm" disabled={actions.length === 0}>
      {copied ? "Copied" : "Copy actions"}
    </button>
  );
}
