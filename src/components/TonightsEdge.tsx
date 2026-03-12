"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import type { TodayPrediction } from "./types";
import { formatEstDate, validateEmail, DAILY_TOKEN_KEY } from "./utils";
import { createCheckout, finalizeCheckout } from "./api";
import MarkdownContent from "./MarkdownContent";

interface TonightsEdgeProps {
  prediction: TodayPrediction | null;
  isLoading: boolean;
  dailyUnlocked: boolean;
  dailyMarkdown: string;
  onUnlock: (token: string) => Promise<void>;
  onScrollToGames: () => void;
  onShare: () => void;
  isShareBusy: boolean;
}

function splitTeaser(text: string): { headline: string; body: string } {
  const lines = text.split("\n").filter((line) => line.trim().length > 0);
  const headline = lines.slice(0, 2).join(" ") || "The board is filtering toward a single moneyline angle.";
  const body = lines.slice(2).join("\n") || "The complete write-up stays behind the daily unlock once the card is ready.";
  return { headline, body };
}

export default function TonightsEdge({
  prediction,
  isLoading,
  dailyUnlocked,
  dailyMarkdown,
  onUnlock,
  onScrollToGames,
  onShare,
  isShareBusy,
}: TonightsEdgeProps) {
  const [dailyEmail, setDailyEmail] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState("");

  const noEdge = Boolean(prediction?.isNoEdgeDay);
  const preview = splitTeaser(prediction?.teaserText || "");

  async function handleCheckout() {
    if (!validateEmail(dailyEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    setUnlocking(true);
    setError("");
    try {
      const checkout = await createCheckout("daily_pick", dailyEmail);
      const token = await finalizeCheckout(checkout.sessionId);
      window.localStorage.setItem(DAILY_TOKEN_KEY, token);
      await onUnlock(token);
      toast.success("Daily edge unlocked!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setUnlocking(false);
    }
  }

  return (
    <section className="hero-card fade-in relative overflow-hidden rounded-[2rem] p-5 md:p-7">
      <div className="hero-card__mesh" />

      <div className="relative">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-xl">
            <p className="section-kicker">Daily edge</p>
            <h1 className="heading mt-3 text-[2.35rem] leading-none text-white md:text-[3.2rem]">LOCKIN filters the board before you pay.</h1>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)] md:text-[0.98rem]">
              One premium moneyline read, generated from the live NBA slate and gated only when the board actually earns it.
            </p>
          </div>
          <div className="space-y-2">
            <span className="date-pill">
              {prediction ? formatEstDate(prediction.date) : "Tonight"}
            </span>
            <div className="hero-price-pill">$5 daily unlock</div>
          </div>
        </div>

        <div className="mb-5 grid gap-2 sm:grid-cols-3">
          <div className="hero-stat">
            <span className="hero-stat__label">Scope</span>
            <span className="hero-stat__value">Moneyline only</span>
          </div>
          <div className="hero-stat">
            <span className="hero-stat__label">Format</span>
            <span className="hero-stat__value">Markdown card</span>
          </div>
          <div className="hero-stat">
            <span className="hero-stat__label">After unlock</span>
            <span className="hero-stat__value">Shareable insight</span>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <div className="skeleton-shimmer h-5 w-3/4 rounded" />
            <div className="rounded-[1.5rem] border border-[color:var(--line)] bg-[color:var(--panel-soft)] p-5">
              <div className="space-y-2.5">
                <div className="skeleton-shimmer h-4 w-full rounded" />
                <div className="skeleton-shimmer h-4 w-5/6 rounded" />
                <div className="skeleton-shimmer h-4 w-4/6 rounded" />
              </div>
            </div>
            <div className="skeleton-shimmer h-12 w-full rounded-xl" />
          </div>
        ) : noEdge ? (
          <div className="rounded-[1.6rem] border border-[color:var(--amber-line)] bg-[color:var(--amber-soft)] p-5 md:p-6">
            <div className="mb-3 flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-[color:var(--amber)]" />
              <p className="heading text-lg font-bold text-[color:var(--amber)]">
                No clean edge on the daily card
              </p>
            </div>
            <p className="mb-5 max-w-2xl leading-relaxed text-[color:var(--text-soft)]">
              LOCKIN is skipping the premium daily pick because the board does not show a clean enough mathematical lane. If you still want action, open a matchup below and work through it inside the paid game chat.
            </p>
            <button
              type="button"
              onClick={onScrollToGames}
              className="primary-button"
            >
              Open the matchup board
            </button>
          </div>
        ) : (
          <>
            <div className="teaser-frame">
              <div className="teaser-frame__header">
                <span className="section-kicker section-kicker--muted">Preview</span>
                <span className="teaser-lock">Locked until purchase</span>
              </div>
              <p className="heading mt-3 text-[1.55rem] leading-tight text-[color:var(--accent-strong)] md:text-[1.9rem]">{preview.headline}</p>
              <div className="mt-4 rounded-[1.35rem] border border-[color:var(--line)] bg-[color:var(--panel-soft)] p-4">
                <div className="blurred space-y-2 text-[color:var(--muted)]">
                  {preview.body.split("\n").map((line, i) => (
                    <p className="leading-relaxed" key={i}>
                      {line}
                    </p>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-[var(--muted)]">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Full report unlocks as markdown plus an exportable share card.
                </div>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {!dailyUnlocked ? (
                <motion.div
                  key="paywall"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mt-5 space-y-3"
                >
                  <div className="space-y-2">
                    <label className="input-label" htmlFor="daily-email">Email for access delivery</label>
                    <input
                      id="daily-email"
                      value={dailyEmail}
                      onChange={(e) => setDailyEmail(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleCheckout()}
                      className="input-field w-full"
                      type="email"
                      autoComplete="email"
                    />
                  </div>
                  <motion.button
                    type="button"
                    onClick={handleCheckout}
                    disabled={unlocking}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    className="primary-button w-full justify-center text-lg"
                  >
                    {unlocking ? (
                      <span className="flex items-center justify-center gap-2">
                        <motion.span
                          className="inline-block h-5 w-5 rounded-full border-2 border-black/30 border-t-black"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        />
                        Processing secure unlock
                      </span>
                    ) : (
                      "Unlock today's edge"
                    )}
                  </motion.button>
                  <p className="text-center text-[11px] text-[var(--muted)]">
                    One payment. Full daily markdown. Share card export included.
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="unlocked"
                  initial={{ opacity: 0, y: 20, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  className="rounded-[1.6rem] border border-[color:var(--accent-line)] bg-[color:var(--accent-soft)] p-5"
                >
                  <div className="mb-4 flex items-center gap-2">
                    <span className="glow-dot" />
                    <span className="heading text-sm font-semibold text-[color:var(--accent-strong)]">Daily edge unlocked</span>
                  </div>
                  <MarkdownContent content={dailyMarkdown} />
                  <div className="mt-5 flex gap-2">
                    <motion.button
                      type="button"
                      onClick={onShare}
                      disabled={isShareBusy}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      className="secondary-button"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                      </svg>
                      {isShareBusy ? "Generating card" : "Export share card"}
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            {error && (
              <p className="mt-3 rounded-[1rem] border border-[color:var(--signal-red-line)] bg-[color:var(--signal-red-soft)] px-4 py-2 text-sm text-[var(--signal-red)]">{error}</p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
