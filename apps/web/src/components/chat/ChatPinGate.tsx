"use client";

import Link from "next/link";
import React from "react";
import type { MouseEvent, ReactNode } from "react";
import { useEffect, useId, useRef, useState } from "react";

const CHAT_PIN = "3636";
const CHAT_PIN_STORAGE_KEY = "pocs-chat-pin-unlocked-v1";
let memoryUnlocked = false;

function isUnlocked(): boolean {
  if (memoryUnlocked) return true;
  try {
    return sessionStorage.getItem(CHAT_PIN_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function saveUnlock(): void {
  memoryUnlocked = true;
  try {
    sessionStorage.setItem(CHAT_PIN_STORAGE_KEY, "true");
  } catch {
    // Session storage can be unavailable in strict/private contexts; keep this as a soft client-side barrier.
  }
}

function PinDialog({
  onUnlock,
  onCancel
}: {
  onUnlock: () => void;
  onCancel?: () => void;
}) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const errorId = useId();

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    inputRef.current?.focus();
    return () => {
      previousFocus?.focus();
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && onCancel) {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ) ?? []
      ).filter((element) => element.offsetParent !== null || element === document.activeElement);

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  const unlock = () => {
    saveUnlock();
    setError(null);
    onUnlock();
  };

  const checkPin = (nextPin: string) => {
    if (nextPin === CHAT_PIN) {
      unlock();
      return;
    }
    if (nextPin.length >= CHAT_PIN.length) {
      setError("Incorrect PIN");
      setPin("");
    }
  };

  const addDigit = (digit: string) => {
    setError(null);
    const next = `${pin}${digit}`.slice(0, CHAT_PIN.length);
    setPin(next);
    checkPin(next);
  };

  const submit = () => checkPin(pin);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background/85 px-4 backdrop-blur-sm">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-xl"
      >
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Soft access check</p>
          <h2 id={titleId} className="text-xl font-semibold text-foreground">Enter AI PIN</h2>
          <p id={descriptionId} className="text-sm text-muted-foreground">
            This keeps casual visitors from opening the assistant. It stays unlocked for this browser session.
          </p>
        </div>

        <input
          ref={inputRef}
          value={pin}
          onChange={(event) => {
            const next = event.target.value.replace(/\D/g, "").slice(0, CHAT_PIN.length);
            setError(null);
            setPin(next);
            checkPin(next);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submit();
            }
          }}
          inputMode="numeric"
          autoComplete="one-time-code"
          aria-label="AI assistant PIN"
          aria-invalid={error ? "true" : "false"}
          aria-describedby={error ? errorId : undefined}
          className="mt-5 w-full rounded-xl border border-border bg-background px-4 py-3 text-center font-mono text-2xl tracking-[0.5em] text-foreground outline-none transition focus:border-primary"
          placeholder="----"
        />

        <div className="mt-4 grid grid-cols-3 gap-2">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => addDigit(digit)}
              className="rounded-lg border border-border bg-background py-3 text-lg font-semibold text-foreground transition hover:border-primary hover:text-primary"
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setError(null);
              setPin((current) => current.slice(0, -1));
            }}
            className="rounded-lg border border-border bg-background py-3 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => addDigit("0")}
            className="rounded-lg border border-border bg-background py-3 text-lg font-semibold text-foreground transition hover:border-primary hover:text-primary"
          >
            0
          </button>
          <button
            type="button"
            onClick={submit}
            className="rounded-lg bg-primary py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            Open
          </button>
        </div>

        {error ? <p id={errorId} role="alert" className="mt-3 text-sm text-red-500">{error}</p> : null}

        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="mt-4 w-full text-sm font-medium text-muted-foreground transition hover:text-foreground"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function ChatPinGate() {
  const [ready, setReady] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    setUnlocked(isUnlocked());
    setReady(true);
  }, []);

  if (!ready) return null;
  if (unlocked) return null;

  return <PinDialog onUnlock={() => setUnlocked(true)} />;
}

export function AskAiLink({
  href,
  className,
  children,
  title,
  ariaCurrent,
  onNavigate
}: {
  href: string;
  className?: string;
  children: ReactNode;
  title?: string;
  ariaCurrent?: "page";
  onNavigate?: () => void;
}) {
  const [showDialog, setShowDialog] = useState(false);
  const linkRef = useRef<HTMLAnchorElement>(null);
  const bypassPinRef = useRef(false);

  const openHref = () => {
    onNavigate?.();
    bypassPinRef.current = true;
    window.setTimeout(() => linkRef.current?.click(), 0);
  };

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (bypassPinRef.current) {
      bypassPinRef.current = false;
      return;
    }
    if (isUnlocked()) {
      onNavigate?.();
      return;
    }
    event.preventDefault();
    setShowDialog(true);
  };

  return (
    <>
      <Link ref={linkRef} href={href} className={className} title={title} aria-current={ariaCurrent} onClick={handleClick}>
        {children}
      </Link>
      {showDialog ? (
        <PinDialog
          onUnlock={() => {
            setShowDialog(false);
            openHref();
          }}
          onCancel={() => setShowDialog(false)}
        />
      ) : null}
    </>
  );
}
