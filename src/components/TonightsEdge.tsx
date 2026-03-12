"use client";

import { useState } from "react";
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
  const headline = lines.slice(0, 2).join(" ") || "Tonight's top edge is being evaluated...";
  const body = lines.slice(2).join("\n") || "Full analysis ready after model processes today's matchup data.";
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setUnlocking(false);
    }
  }

  return (
    <section className="rotating-border lockin-card fade-in relative overflow-hidden rounded-2xl p-5 md:p-6">
      {/* Background glows */}
      <div className="pointer-events-none absolute -right-20 -top-20 h-40 w-40 rounded-full bg-[#00c853]/[0.04] blur-[60px]" />
      <div className="pointer-events-none absolute -left-16 bottom-0 h-32 w-32 rounded-full bg-[#00ff87]/[0.03] blur-[50px]" />

      <div className="relative">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="heading text-2xl font-bold text-white md:text-3xl">Tonight&apos;s Edge</h1>
            <p className="mt-0.5 text-xs text-[#8b92a5]">AI-filtered moneyline analysis</p>
          </div>
          <span className="mono rounded-full border border-[#ffd700]/25 bg-[#ffd700]/[0.06] px-3 py-1 text-[11px] font-medium text-[#ffd700]">
            {prediction ? formatEstDate(prediction.date) : "LIVE"}
          </span>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <div className="skeleton-shimmer h-5 w-3/4 rounded" />
            <div className="rounded-lg border border-white/[0.04] bg-black/10 p-4">
              <div className="space-y-2.5">
                <div className="skeleton-shimmer h-4 w-full rounded" />
                <div className="skeleton-shimmer h-4 w-5/6 rounded" />
                <div className="skeleton-shimmer h-4 w-4/6 rounded" />
              </div>
            </div>
            <div className="skeleton-shimmer h-12 w-full rounded-xl" />
          </div>
        ) : noEdge ? (
          <div className="rounded-xl border border-[#ff6b35]/30 bg-gradient-to-br from-[#ff6b35]/[0.06] to-transparent p-5">
            <div className="mb-3 flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#ff6b35]" />
              <p className="heading text-lg font-bold text-[#ff6b35]">
                NO EDGE DETECTED TODAY
              </p>
            </div>
            <p className="mb-5 leading-relaxed text-[#f5f5f3]/80">
              Our engine found no mathematical edge against Vegas tonight. We are not touts and
              won&apos;t force a daily lock for $5.
              Protect your bankroll — if you&apos;re still looking for action, open a matchup below and
              discuss it with AI for $2.
            </p>
            <button
              type="button"
              onClick={onScrollToGames}
              className="btn-glow rounded-xl bg-gradient-to-r from-[#00c853] to-[#00b848] px-5 py-2.5 font-semibold text-black transition hover:from-[#00ff87] hover:to-[#00c853]"
            >
              Open matchups and build your edge
            </button>
          </div>
        ) : (
          <>
            <p className="neon-green mb-3 text-lg font-medium text-[#00ff87]">{preview.headline}</p>
            <div className="mb-5 rounded-xl border border-white/[0.06] bg-black/20 p-4">
              <div className="blurred text-[#8b92a5]">
                {preview.body.split("\n").map((line, i) => (
                  <p className="leading-relaxed" key={i}>
                    {line}
                  </p>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-[#8b92a5]">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Content locked — unlock to reveal full analysis
              </div>
            </div>

            {!dailyUnlocked ? (
              <div className="space-y-3">
                <input
                  value={dailyEmail}
                  onChange={(e) => setDailyEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCheckout()}
                  className="input-field w-full"
                  placeholder="you@email.com"
                  type="email"
                />
                <button
                  type="button"
                  onClick={handleCheckout}
                  disabled={unlocking}
                  className="btn-glow btn-shine w-full rounded-xl bg-gradient-to-r from-[#00c853] to-[#00b848] px-4 py-3.5 text-lg font-bold text-[#0a0e1a] transition hover:from-[#00ff87] hover:to-[#00c853] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {unlocking ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                      Processing...
                    </span>
                  ) : (
                    "Unlock Today's Edge — $5"
                  )}
                </button>
                <p className="text-center text-[11px] text-[#8b92a5]">
                  One-time daily access &middot; Full markdown analysis &middot; Shareable insight card
                </p>
              </div>
            ) : (
              <div className="fade-in rounded-xl border border-[#00c853]/20 bg-gradient-to-br from-[#00c853]/[0.04] to-transparent p-5">
                <div className="mb-4 flex items-center gap-2">
                  <span className="glow-dot" />
                  <span className="heading text-sm font-semibold text-[#00ff87]">Daily edge unlocked</span>
                </div>
                <MarkdownContent content={dailyMarkdown} />
                <div className="mt-5 flex gap-2">
                  <button
                    type="button"
                    onClick={onShare}
                    disabled={isShareBusy}
                    className="btn-wave flex items-center gap-1.5 rounded-lg border border-[#00c853]/30 px-4 py-2 text-sm text-[#00ff87] transition hover:bg-[#00c853]/10"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                    {isShareBusy ? "Generating..." : "Share your edge"}
                  </button>
                </div>
              </div>
            )}
            {error && (
              <p className="mt-3 rounded-lg border border-[#ff3b3b]/20 bg-[#ff3b3b]/[0.06] px-4 py-2 text-sm text-[#ff3b3b]">{error}</p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
