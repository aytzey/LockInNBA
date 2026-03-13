"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import type { TodayPrediction } from "./types";
import { DAILY_TOKEN_KEY, LEAD_EMAIL_KEY, validateEmail } from "./utils";
import { createCheckout, waitForCheckout, mockComplete } from "./api";
import MarkdownContent from "./MarkdownContent";
import { LockinMark } from "./LockinBrand";

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
  priceSubtext: string;
  noEdgeMessage: string;
  isPromoActive: boolean;
  teaserGuardTerms: string[];
}

function containsSpoiler(text: string, terms: string[]): boolean {
  const normalized = text.trim();
  if (!normalized) {
    return false;
  }

  if (/[A-Z]{2,4}\s*@\s*[A-Z]{2,4}/.test(normalized) || /\bvs\.?\b/i.test(normalized)) {
    return true;
  }

  return terms.some((term) => {
    const trimmed = term.trim();
    if (!trimmed) {
      return false;
    }

    if (trimmed.includes(" ")) {
      return normalized.toLowerCase().includes(trimmed.toLowerCase());
    }

    const pattern = new RegExp(`\\b${trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    return pattern.test(normalized);
  });
}

function splitTeaser(text: string, guardTerms: string[]): { headline: string; blurredLines: string[] } {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const spoilerDetected = containsSpoiler(lines.join(" "), guardTerms);
  const headline = !spoilerDetected && lines.length > 0
    ? lines.slice(0, 2).join(" ")
    : "One game lit up every signal tonight. The math is screaming.";
  const blurredLines = lines.slice(2);

  if (!spoilerDetected && blurredLines.length > 0) {
    return { headline, blurredLines };
  }

  return {
    headline,
    blurredLines: [
      "Tonight the engine identified one board pocket where price, pace pressure, and lineup context refuse to agree.",
      "Risk framing, bankroll sizing, and late-line sensitivity stay locked until the pass is opened.",
      "Full unlock reveals the exact side, confidence stack, and the market trap we expect most people to miss.",
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
  priceSubtext,
  noEdgeMessage,
  isPromoActive,
  teaserGuardTerms,
}: TonightsEdgeProps) {
  const noEdge = Boolean(prediction?.isNoEdgeDay);
  const hasPrediction = Boolean(prediction?.hasPrediction && prediction?.teaserText.trim());
  const preview = splitTeaser((hasPrediction ? prediction?.teaserText : "") || "", teaserGuardTerms);
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
      priceSubtext={priceSubtext}
      noEdgeMessage={noEdgeMessage}
      noEdge={noEdge}
      hasPrediction={hasPrediction}
      preview={preview}
      isPromoActive={isPromoActive}
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
  priceSubtext,
  noEdgeMessage,
  noEdge,
  hasPrediction,
  preview,
  isPromoActive,
}: {
  isLoading: boolean;
  dailyUnlocked: boolean;
  dailyMarkdown: string;
  onUnlock: (token: string) => Promise<void>;
  onScrollToGames: () => void;
  onShare: () => void;
  isShareBusy: boolean;
  ctaText: string;
  priceSubtext: string;
  noEdgeMessage: string;
  noEdge: boolean;
  hasPrediction: boolean;
  preview: { headline: string; blurredLines: string[] };
  isPromoActive: boolean;
}) {
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState("");
  const [leadEmail, setLeadEmail] = useState("");

  useEffect(() => {
    try {
      setLeadEmail(window.localStorage.getItem(LEAD_EMAIL_KEY) || "");
    } catch {
      // Local storage may be unavailable in private browser contexts.
    }
  }, []);

  useEffect(() => {
    if (!leadEmail.trim()) {
      return;
    }

    try {
      window.localStorage.setItem(LEAD_EMAIL_KEY, leadEmail.trim());
    } catch {
      // Ignore local persistence failures.
    }
  }, [leadEmail]);

  async function handleCheckout() {
    setUnlocking(true);
    setError("");

    try {
      const email = leadEmail.trim().toLowerCase();
      if (isPromoActive && !validateEmail(email)) {
        throw new Error("Enter a valid email to unlock free access.");
      }

      const checkout = await createCheckout({
        type: "daily_pick",
        email: isPromoActive ? email : undefined,
      });

      let token: string;
      if (checkout.checkoutUrl === "__free__") {
        token = checkout.accessToken || "";
      } else if (checkout.checkoutUrl === "__mock__") {
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

      if (!token) {
        throw new Error("Unlock could not be completed.");
      }

      window.localStorage.setItem(DAILY_TOKEN_KEY, token);
      await onUnlock(token);
      toast.success(isPromoActive ? "Free access unlocked." : "Daily edge unlocked.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setUnlocking(false);
    }
  }

  return (
    <section className="hero-card">
      <AnimatePresence initial={false} mode="wait">
        {dailyUnlocked ? (
          <motion.div
            key="unlocked"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -18 }}
            className="space-y-6"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--money-green-line)] bg-[color:var(--money-green-soft)] px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-[color:var(--money-green)] md:px-4 md:py-2 md:text-[11px]">
              <span className="glow-dot" />
              Daily edge unlocked
            </div>

            <div className="rounded-[1.25rem] border border-[color:var(--line)] bg-[color:var(--panel-soft)] px-4 py-4 md:rounded-[1.8rem] md:px-7 md:py-6">
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
              Browse AI matchups
            </button>
          </motion.div>
        ) : !hasPrediction && !isLoading ? (
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
            className="space-y-4 md:space-y-6"
          >
            <div className="hero-preview">
              <h1 className="heading hero-preview__headline">{preview.headline}</h1>
              <div className="hero-preview__blur-shell">
                <div className="hero-preview__brandwash" aria-hidden="true">
                  <LockinMark className="h-full w-full" />
                </div>
                <div className="hero-preview__blur-stack blurred space-y-2 md:space-y-3">
                  {preview.blurredLines.map((line, index) => (
                    <p key={index} className="hero-preview__blur-line text-sm md:text-base">
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
              {unlocking ? (isPromoActive ? "Opening free access..." : "Processing secure unlock...") : ctaText}
            </button>

            <p className="hero-price-whisper">{priceSubtext}</p>

            {isPromoActive ? (
              <div className="hero-lead-capture">
                <label className="input-label" htmlFor="hero-lead-email">Email required for launch week access</label>
                <div className="hero-lead-capture__row">
                  <input
                    id="hero-lead-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    value={leadEmail}
                    onChange={(event) => setLeadEmail(event.target.value)}
                    placeholder="you@lockinmail.com"
                    className="input-field"
                  />
                  <span className="hero-lead-capture__badge">FREE</span>
                </div>
              </div>
            ) : null}

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
