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
    <section className="lockin-card relative overflow-hidden rounded-xl p-5">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="heading text-2xl text-white md:text-3xl">Tonight&apos;s Edge</h1>
        <span className="mono rounded-full border border-[#ffd700]/30 bg-black/40 px-3 py-1 text-[11px] text-[#ffd700]">
          {prediction ? formatEstDate(prediction.date) : "LIVE"}
        </span>
      </div>

      {isLoading ? (
        <div className="animate-pulse space-y-3">
          <div className="h-5 w-3/4 rounded bg-white/5" />
          <div className="rounded-md border border-white/5 bg-black/10 p-4">
            <div className="space-y-2">
              <div className="h-4 w-full rounded bg-white/5" />
              <div className="h-4 w-5/6 rounded bg-white/5" />
              <div className="h-4 w-4/6 rounded bg-white/5" />
            </div>
          </div>
          <div className="h-12 w-full rounded-lg bg-white/5" />
        </div>
      ) : noEdge ? (
        <div className="rounded-lg border border-[#ff6b35]/45 bg-[#0a0e1a] p-4 text-sm text-white">
          <div className="mb-3 flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#ff6b35]" />
            <p className="text-lg font-semibold text-[#ff6b35]">
              NO EDGE DETECTED TODAY
            </p>
          </div>
          <p className="mb-4 leading-relaxed text-[#f5f5f3]">
            Our engine found no mathematical edge against Vegas tonight. We are not touts and
            won&apos;t force a daily lock for $5.
            Protect your bankroll — if you&apos;re still looking for action, open a matchup below and
            discuss it with AI for $2.
          </p>
          <button
            type="button"
            onClick={onScrollToGames}
            className="rounded-lg bg-[#00c853] px-4 py-2 font-semibold text-black transition hover:bg-[#00ff87]"
          >
            Open matchups and build your edge
          </button>
        </div>
      ) : (
        <>
          <p className="mb-2 text-lg text-[#00ff87]">{preview.headline}</p>
          <div className="mb-4 rounded-md border border-white/10 bg-black/25 p-4">
            <div className="text-[#8b92a5] blurred select-none">
              {preview.body.split("\n").map((line, i) => (
                <p className="leading-relaxed" key={i}>
                  {line}
                </p>
              ))}
            </div>
          </div>

          {!dailyUnlocked ? (
            <div className="space-y-3">
              <input
                value={dailyEmail}
                onChange={(e) => setDailyEmail(e.target.value)}
                className="w-full rounded-lg border border-[#00c853]/40 bg-[#0f1524] px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#00c853]"
                placeholder="you@email.com"
                type="email"
              />
              <button
                type="button"
                onClick={handleCheckout}
                disabled={unlocking}
                className="w-full rounded-lg bg-[#00c853] px-4 py-3 text-lg font-semibold text-[#0a0e1a] transition hover:bg-[#00ff87] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {unlocking ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                    Processing...
                  </span>
                ) : (
                  "Unlock Today's Edge — $5"
                )}
              </button>
            </div>
          ) : (
            <div className="rounded-lg border border-[#00c853]/25 bg-[#0f1524] p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-[#00c853]" />
                <span className="heading text-sm text-[#00ff87]">Daily edge unlocked</span>
              </div>
              <MarkdownContent content={dailyMarkdown} />
              <button
                type="button"
                onClick={onShare}
                disabled={isShareBusy}
                className="mt-4 rounded-lg border border-[#00c853]/30 px-4 py-2 text-sm text-[#00ff87] transition hover:bg-[#00c853]/15"
              >
                {isShareBusy ? "Generating..." : "Share your edge"}
              </button>
            </div>
          )}
          {error && (
            <p className="mt-2 rounded bg-[#ff3b3b]/10 px-3 py-1.5 text-sm text-[#ff3b3b]">{error}</p>
          )}
        </>
      )}
    </section>
  );
}
