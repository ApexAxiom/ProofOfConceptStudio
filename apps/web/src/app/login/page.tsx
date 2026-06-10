"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/chat-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      if (!res.ok) {
        setError("Invalid username or password.");
        return;
      }
      const next = searchParams.get("next");
      router.replace(next && next.startsWith("/") ? next : "/");
      router.refresh();
    } catch {
      setError("Sign-in failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4 text-left">
      <div>
        <label htmlFor="username" className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Username
        </label>
        <input
          id="username"
          type="text"
          autoComplete="username"
          required
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
        />
      </div>
      <div>
        <label htmlFor="password" className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
        />
      </div>
      {error ? <p className="text-sm text-rose-400">{error}</p> : null}
      <button type="submit" disabled={submitting} className="btn-secondary w-full text-sm">
        {submitting ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-sm flex-col justify-center">
      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Intelligence Hub</p>
        <h1 className="mt-2 text-xl font-semibold text-foreground">Sign in</h1>
        <p className="mt-2 text-sm text-muted-foreground">Internal category market intelligence. Access is restricted.</p>
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
