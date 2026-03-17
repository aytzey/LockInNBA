"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import toast from "react-hot-toast";
import DailyPickCard from "./DailyPickCard";
import { LockinMark } from "./LockinBrand";
import type { DailyPick, TodayPrediction } from "./types";
import { DAILY_TOKEN_KEY, LEAD_EMAIL_KEY, validateEmail } from "./utils";
import { createCheckout, mockComplete, waitForCheckout } from "./api";

interface TonightsEdgeProps {
  prediction: TodayPrediction | null;
  isLoading: boolean;
  dailyUnlocked: boolean;
  unlockedPicks: DailyPick[];
  onUnlock: (token: string) => Promise<void>;
  onScrollToGames: () => void;
  onShare: () => void;
  isShareBusy: boolean;
  ctaText: string;
  priceSubtext: string;
  noEdgeMessage: string;
  isPromoActive: boolean;
}

const BLUR_LINE_WIDTHS = ["100%", "91%", "83%", "72%", "87%", "64%"];

export default function TonightsEdge({
  prediction,
  isLoading,
  dailyUnlocked,
  unlockedPicks,
  onUnlock,
  onScrollToGames,
  onShare,
  isShareBusy,
  ctaText,
  priceSubtext,
  noEdgeMessage,
  isPromoActive,
}: TonightsEdgeProps) {
  const noEdge = Boolean(prediction?.status === "no_edge" || prediction?.isNoEdgeDay);
  const hasPrediction = Boolean(prediction?.status === "ready" && prediction?.hasPrediction);
  const pickCount = Math.max(1, Math.min(prediction?.pickCount || 2, 3));

  return (
    <TonightsEdgeContent
      isLoading={isLoading}
      dailyUnlocked={dailyUnlocked}
      unlockedPicks={unlockedPicks}
      onUnlock={onUnlock}
      onScrollToGames={onScrollToGames}
      onShare={onShare}
      isShareBusy={isShareBusy}
      ctaText={ctaText}
      priceSubtext={priceSubtext}
      noEdgeMessage={noEdgeMessage}
      noEdge={noEdge}
      hasPrediction={hasPrediction}
      pickCount={pickCount}
      isPromoActive={isPromoActive}
    />
  );
}

function TonightsEdgeContent({
  isLoading,
  dailyUnlocked,
  unlockedPicks,
  onUnlock,
  onScrollToGames,
  onShare,
  isShareBusy,
  ctaText,
  priceSubtext,
  noEdgeMessage,
  noEdge,
  hasPrediction,
  pickCount,
  isPromoActive,
}: {
  isLoading: boolean;
  dailyUnlocked: boolean;
  unlockedPicks: DailyPick[];
  onUnlock: (token: string) => Promise<void>;
  onScrollToGames: () => void;
  onShare: () => void;
  isShareBusy: boolean;
  ctaText: string;
  priceSubtext: string;
  noEdgeMessage: string;
  noEdge: boolean;
  hasPrediction: boolean;
  pickCount: number;
  isPromoActive: boolean;
}) {
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [showLeadCapture, setShowLeadCapture] = useState(false);

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
    if (!hasPrediction) {
      return;
    }

    setUnlocking(true);
    setError("");

    try {
      const email = leadEmail.trim().toLowerCase();
      if (isPromoActive && !validateEmail(email)) {
        setShowLeadCapture(true);
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
        } catch {
          // noop
        }
      }

      if (!token) {
        throw new Error("Unlock could not be completed.");
      }

      window.localStorage.setItem(DAILY_TOKEN_KEY, token);
      await onUnlock(token);
      toast.success(isPromoActive ? "Free access unlocked." : "Daily edge unlocked.");
      setShowLeadCapture(false);
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
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--money-green-line)] bg-[color:var(--money-green-soft)] px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-[color:var(--money-green)] md:px-4 md:py-2 md:text-[11px]">
                <span className="glow-dot" />
                {isPromoActive ? "Launch Week — Free Access" : "Daily Edge Unlocked"}
              </div>
              {isPromoActive ? (
                <p className="text-sm text-[color:var(--silver-gray)]">
                  Free during launch week. Regular price: $5/day.
                </p>
              ) : null}
            </div>

            {unlockedPicks.length > 0 ? (
              <div className="grid gap-3 md:gap-5 xl:grid-cols-2">
                {unlockedPicks.map((pick) => (
                  <DailyPickCard key={pick.id} pick={pick} />
                ))}
              </div>
            ) : (
              <div className="pending-card">
                <div className="pending-card__eyebrow">LOCK STATUS</div>
                <h1 className="heading pending-card__title">Today&apos;s edge is still being prepared.</h1>
                <p className="pending-card__body">Check back at 2 PM ET.</p>
              </div>
            )}

            <button
              type="button"
              onClick={onShare}
              disabled={isShareBusy}
              className="secondary-button justify-center"
            >
              {isShareBusy ? "Generating..." : "Export share card"}
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
        ) : (
          <motion.div
            key={hasPrediction ? "locked-ready" : "locked-pending"}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -18 }}
            className="space-y-4 md:space-y-6"
          >
            <div className="hero-preview hero-preview--minimal">
              <div className="hero-preview__blur-shell">
                <div className="hero-preview__brandwash" aria-hidden="true">
                  <LockinMark className="h-full w-full" />
                </div>

                {hasPrediction ? (
                  <div className="hero-preview__pick-stack blurred" aria-hidden="true">
                    {Array.from({ length: pickCount }).map((_, index) => (
                      <div key={index} className="hero-preview__pick-shell">
                        <div className="hero-preview__pick-header">
                          <span className="hero-preview__pick-pill" />
                          <span className="hero-preview__pick-badge" />
                        </div>
                        <div className="hero-preview__pick-identity">
                          <span className="hero-preview__pick-logo" />
                          <span className="hero-preview__pick-line hero-preview__pick-line--short" />
                        </div>
                        <div className="hero-preview__pick-market">
                          <span className="hero-preview__pick-line hero-preview__pick-line--medium" />
                          <span className="hero-preview__pick-line hero-preview__pick-line--shorter" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="hero-preview__blur-stack blurred space-y-2 md:space-y-3" aria-hidden="true">
                    {BLUR_LINE_WIDTHS.map((width, index) => (
                      <p
                        key={index}
                        className="hero-preview__blur-line text-sm md:text-base"
                        style={{ maxWidth: width }}
                      >
                        Analysis complete. One side carries a statistical edge the market has not fully priced.
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleCheckout}
              disabled={unlocking || !hasPrediction || isLoading}
              className="primary-button primary-button--hero justify-center disabled:opacity-45"
            >
              {unlocking
                ? (isPromoActive ? "Opening free access..." : "Processing secure unlock...")
                : hasPrediction
                  ? ctaText
                  : "Today's edge is being prepared"}
            </button>

            <p className="hero-price-whisper">
              {hasPrediction ? priceSubtext : "Check back at 2 PM ET."}
            </p>

            {showLeadCapture && isPromoActive && hasPrediction ? (
              <div className="hero-lead-capture">
                <label className="input-label" htmlFor="hero-lead-email">Email required for free launch access</label>
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
                  <button
                    type="button"
                    onClick={handleCheckout}
                    disabled={unlocking}
                    className="hero-lead-capture__badge"
                  >
                    Continue
                  </button>
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
