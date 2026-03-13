"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import type { TodayPrediction } from "./types";
import { DAILY_TOKEN_KEY } from "./utils";
import { createCheckout, waitForCheckout, mockComplete } from "./api";
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
  ctaText: string;
  noEdgeMessage: string;
}

function splitTeaser(text: string): { headline: string; blurredLines: string[] } {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const headline = lines.slice(0, 2).join(" ") || "Our engine went 5-0 this week. Tonight's edge is ready.";
  const blurredLines = lines.slice(2);

  if (blurredLines.length > 0) {
    return { headline, blurredLines };
  }

  return {
    headline,
    blurredLines: [
      "Confidence stack confirms market mispricing against current pace, travel, and rotation context.",
      "Risk section stays locked until purchase, with bankroll framing and trigger thresholds included.",
      "Full markdown unlock reveals the exact moneyline, edge thesis, and late-swap caution flags.",
    ],
  };
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
  ctaText,
  noEdgeMessage,
}: TonightsEdgeProps) {
  const noEdge = Boolean(prediction?.isNoEdgeDay);
  const hasPrediction = Boolean(prediction?.hasPrediction && prediction?.teaserText.trim());
  const preview = splitTeaser(prediction?.teaserText || "");
  return (
    <TonightsEdgeContent
      isLoading={isLoading}
      dailyUnlocked={dailyUnlocked}
      dailyMarkdown={dailyMarkdown}
      onUnlock={onUnlock}
      onScrollToGames={onScrollToGames}
      onShare={onShare}
      isShareBusy={isShareBusy}
      ctaText={ctaText}
      noEdgeMessage={noEdgeMessage}
      noEdge={noEdge}
      hasPrediction={hasPrediction}
      preview={preview}
    />
  );
}

function TonightsEdgeContent({
  isLoading,
  dailyUnlocked,
  dailyMarkdown,
  onUnlock,
  onScrollToGames,
  onShare,
  isShareBusy,
  ctaText,
  noEdgeMessage,
  noEdge,
  hasPrediction,
  preview,
}: {
  isLoading: boolean;
  dailyUnlocked: boolean;
  dailyMarkdown: string;
  onUnlock: (token: string) => Promise<void>;
  onScrollToGames: () => void;
  onShare: () => void;
  isShareBusy: boolean;
  ctaText: string;
  noEdgeMessage: string;
  noEdge: boolean;
  hasPrediction: boolean;
  preview: { headline: string; blurredLines: string[] };
}) {
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState("");

  async function handleCheckout() {
    setUnlocking(true);
    setError("");

    try {
      const checkout = await createCheckout({ type: "daily_pick" });

      let token: string;
      if (checkout.checkoutUrl === "__mock__") {
        token = await mockComplete(checkout.sessionId);
      } else {
        const popup = window.open(checkout.checkoutUrl, "lemonsqueezy", "width=460,height=720,left=200,top=100");
        if (!popup) {
          window.location.href = checkout.checkoutUrl;
          return;
        }
        token = (await waitForCheckout(checkout.sessionId)).accessToken || "";
        try {
          popup.close();
        } catch {}
      }

      window.localStorage.setItem(DAILY_TOKEN_KEY, token);
      await onUnlock(token);
      toast.success("Daily edge unlocked.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setUnlocking(false);
    }
  }

  return (
    <section className="hero-card">
      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="space-y-5"
          >
            <div className="skeleton-shimmer h-7 w-3/4 rounded-full" />
            <div className="rounded-[1.6rem] border border-[color:var(--line)] px-6 py-7">
              <div className="space-y-3">
                <div className="skeleton-shimmer h-4 w-full rounded-full" />
                <div className="skeleton-shimmer h-4 w-11/12 rounded-full" />
                <div className="skeleton-shimmer h-4 w-10/12 rounded-full" />
                <div className="skeleton-shimmer h-4 w-9/12 rounded-full" />
              </div>
            </div>
            <div className="skeleton-shimmer h-14 w-full rounded-full" />
          </motion.div>
        ) : dailyUnlocked ? (
          <motion.div
            key="unlocked"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -18 }}
            className="space-y-6"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--money-green-line)] bg-[color:var(--money-green-soft)] px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-[color:var(--money-green)]">
              <span className="glow-dot" />
              Daily edge unlocked
            </div>

            <div className="rounded-[1.8rem] border border-[color:var(--line)] bg-[color:var(--panel-soft)] px-6 py-6 md:px-7">
              <MarkdownContent content={dailyMarkdown} />
            </div>

            <button
              type="button"
              onClick={onShare}
              disabled={isShareBusy}
              className="secondary-button justify-center"
            >
              {isShareBusy ? "Generating share card..." : "Export share card"}
            </button>
          </motion.div>
        ) : noEdge ? (
          <motion.div
            key="no-edge"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -18 }}
            className="no-edge-card"
          >
            <div className="no-edge-card__signal">
              <span className="live-dot" />
              SYSTEM ALERT
            </div>
            <h1 className="heading no-edge-card__title">NO EDGE DETECTED TODAY</h1>
            <p className="no-edge-card__body">{noEdgeMessage}</p>
            <button type="button" onClick={onScrollToGames} className="secondary-button justify-center">
              Ask AI about a matchup — $2
            </button>
          </motion.div>
        ) : !hasPrediction ? (
          <motion.div
            key="pending"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -18 }}
            className="pending-card"
          >
            <div className="pending-card__eyebrow">LOCK STATUS</div>
            <h1 className="heading pending-card__title">Today&apos;s picks are being locked in.</h1>
            <p className="pending-card__body">Check back at 2 PM EST.</p>
          </motion.div>
        ) : (
          <motion.div
            key="locked"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -18 }}
            className="space-y-6"
          >
            <div className="hero-preview">
              <h1 className="heading hero-preview__headline">{preview.headline}</h1>
              <div className="hero-preview__blur-shell">
                <div className="blurred space-y-3">
                  {preview.blurredLines.map((line, index) => (
                    <p key={index} className="hero-preview__blur-line">
                      {line}
                    </p>
                  ))}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCheckout}
              disabled={unlocking}
              className="primary-button primary-button--hero justify-center"
            >
              {unlocking ? "Processing secure unlock..." : ctaText}
            </button>

            {error ? (
              <p className="rounded-[1rem] border border-[color:var(--alert-red-line)] bg-[color:var(--alert-red-soft)] px-4 py-3 text-sm text-[color:var(--alert-red)]">
                {error}
              </p>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
