"use client";

import { useState } from "react";
import { validateEmail, DAILY_TOKEN_KEY } from "./utils";

interface RestoreAccessProps {
  onRestore: (token: string) => Promise<void>;
}

export default function RestoreAccess({ onRestore }: RestoreAccessProps) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

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
    } catch {
      setMessage("Could not restore access. Please try again.");
      setIsError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <footer className="mt-6 space-y-3 rounded-lg border border-[#2a3852] bg-[#101a2c] px-4 py-4 text-xs text-[#8b92a5]">
      <div id="restore" className="space-y-2">
        <p className="text-sm text-white">Already paid? Restore your access</p>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded border border-[#00c853]/30 bg-[#0f1524] p-2 text-white outline-none transition focus:border-[#00c853]"
          placeholder="you@email.com"
          type="email"
        />
        <button
          type="button"
          onClick={handleRestore}
          disabled={busy}
          className="rounded bg-[#ff6b35] px-3 py-2 text-sm font-medium text-black transition hover:bg-[#ff8a56] disabled:opacity-50"
        >
          {busy ? (
            <span className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-black/30 border-t-black" />
              Restoring...
            </span>
          ) : (
            "Restore access"
          )}
        </button>
        {message && (
          <p className={`text-sm ${isError ? "text-[#ff3b3b]" : "text-[#00c853]"}`}>
            {message}
          </p>
        )}
      </div>
      <p className="pt-2 text-[11px] text-[#8b92a5]">
        For entertainment purposes only. Not financial advice. We do not accept wagers. If you or
        someone you know has a gambling problem, call 1-800-GAMBLER.
      </p>
    </footer>
  );
}
