"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { validateEmail, DAILY_TOKEN_KEY } from "./utils";

interface RestoreAccessProps {
  onRestore: (token: string) => Promise<void>;
}

export default function RestoreAccess({ onRestore }: RestoreAccessProps) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  async function handleRestore() {
    if (!validateEmail(email)) {
      setMessage("Enter a valid email address.");
      setIsError(true);
      return;
    }
    setBusy(true);
    setMessage("");
    setIsError(false);
    try {
      const res = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.message || "No purchase found for this email.");
        setIsError(true);
        return;
      }
      const verify = await fetch(data.magicLink);
      const verifyBody = await verify.json();
      if (!verify.ok || !verifyBody.accessToken) {
        throw new Error("Could not verify magic link.");
      }
      window.localStorage.setItem(DAILY_TOKEN_KEY, verifyBody.accessToken);
      await onRestore(verifyBody.accessToken);
      setMessage("Access restored successfully!");
      setIsError(false);
      toast.success("Access restored!");
    } catch {
      setMessage("Could not restore access. Please try again.");
      setIsError(true);
      toast.error("Restore failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <footer className="mt-6 overflow-hidden rounded-[1.75rem] border border-[color:var(--line)] bg-[color:var(--panel)]">
      <div className="border-b border-[color:var(--line)] px-5 py-4">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex w-full items-center justify-between text-sm text-[var(--muted)] transition hover:text-white"
        >
          <span className="flex items-center gap-2">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            Already paid? Restore today&apos;s access
          </span>
          <svg className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isOpen && (
          <div className="fade-in mt-3 space-y-2.5">
            <div className="space-y-2">
              <label className="input-label" htmlFor="restore-email">Purchase email</label>
              <input
                id="restore-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleRestore()}
                className="input-field w-full"
                type="email"
                autoComplete="email"
              />
            </div>
            <button
              type="button"
              onClick={handleRestore}
              disabled={busy}
              className="secondary-button disabled:opacity-50"
            >
              {busy ? (
                <span className="flex items-center gap-2">
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                  Restoring access
                </span>
              ) : (
                "Restore access"
              )}
            </button>
            {message && (
              <p className={`text-sm ${isError ? "text-[var(--signal-red)]" : "text-[color:var(--accent-strong)]"}`}>{message}</p>
            )}
          </div>
        )}
      </div>

      <div className="px-5 py-4 text-center text-[11px] leading-relaxed text-[color:var(--muted)]/80">
        For entertainment purposes only. LOCKIN does not accept wagers or guarantee outcomes. If you or someone you know has a gambling problem, call 1-800-GAMBLER.
      </div>
    </footer>
  );
}
