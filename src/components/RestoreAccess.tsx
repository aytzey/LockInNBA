"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { validateEmail, DAILY_TOKEN_KEY } from "./utils";

interface RestoreAccessProps {
  onRestore: (token: string) => Promise<void>;
  footerDisclaimer: string;
}

export default function RestoreAccess({ onRestore, footerDisclaimer }: RestoreAccessProps) {
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
      setMessage("Access restored.");
      setIsError(false);
      setIsOpen(false);
      toast.success("Access restored.");
    } catch {
      setMessage("Could not restore access. Please try again.");
      setIsError(true);
      toast.error("Restore failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <footer className="space-y-4 border-t border-[color:var(--line)] pt-5">
      <div className="text-center">
        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          className="text-[11px] text-[color:var(--silver-gray)] transition hover:text-[color:var(--pure-white)]"
        >
          Already paid? Restore your access
        </button>

        {isOpen ? (
          <div className="fade-in mx-auto mt-3 max-w-md space-y-2">
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="restore-email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && handleRestore()}
                className="input-field w-full"
                type="email"
                autoComplete="email"
                placeholder="Purchase email"
              />
              <button
                type="button"
                onClick={handleRestore}
                disabled={busy}
                className="secondary-button min-w-[138px] justify-center disabled:opacity-50"
              >
                {busy ? "Restoring..." : "Restore"}
              </button>
            </div>

            {message ? (
              <p className={`text-[11px] ${isError ? "text-[color:var(--alert-red)]" : "text-[color:var(--money-green)]"}`}>
                {message}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <p className="mx-auto max-w-3xl text-center text-[10px] leading-5 text-[color:var(--silver-gray)]">
        {footerDisclaimer}
      </p>
    </footer>
  );
}
