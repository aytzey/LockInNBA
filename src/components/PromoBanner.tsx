"use client";

import { useEffect, useMemo, useState } from "react";
import type { PromoBanner as PromoBannerState } from "./types";

interface PromoBannerProps {
  promoBanner: PromoBannerState | null;
}

function formatUnit(value: number): string {
  return value.toString().padStart(2, "0");
}

function getTimeLeft(endDatetime: string, now = Date.now()) {
  const endsAt = new Date(endDatetime).getTime();
  const difference = endsAt - now;

  if (Number.isNaN(endsAt) || difference <= 0) {
    return null;
  }

  const days = Math.floor(difference / (1000 * 60 * 60 * 24));
  const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((difference % (1000 * 60)) / 1000);

  return {
    days,
    hours,
    minutes,
    seconds,
  };
}

export default function PromoBanner({ promoBanner }: PromoBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const dismissKey = useMemo(
    () => (promoBanner?.endDatetime ? `lockin_promo_dismissed:${promoBanner.endDatetime}:${promoBanner.updatedAt}` : ""),
    [promoBanner?.endDatetime, promoBanner?.updatedAt],
  );
  const storedDismissed =
    dismissKey && typeof window !== "undefined"
      ? (() => {
          try {
            return window.localStorage.getItem(dismissKey) === "1";
          } catch {
            return false;
          }
        })()
      : false;
  const timeLeft = promoBanner?.endDatetime ? getTimeLeft(promoBanner.endDatetime, now) : null;

  useEffect(() => {
    if (!promoBanner?.endDatetime) {
      return;
    }

    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [promoBanner?.endDatetime]);

  if (!promoBanner || dismissed || storedDismissed || !timeLeft) {
    return null;
  }

  return (
    <section className="promo-banner">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 md:px-8">
        <div className="promo-banner__copy">
          <p className="promo-banner__eyebrow">Launch Week</p>
          <p className="promo-banner__text">{promoBanner.bannerText}</p>
        </div>

        <div className="promo-banner__timer mono" aria-label="Launch week countdown">
          <span className="promo-banner__timer-block">
            <strong>{formatUnit(timeLeft.days)}</strong>
            <em>d</em>
          </span>
          <span className="promo-banner__timer-block">
            <strong>{formatUnit(timeLeft.hours)}</strong>
            <em>h</em>
          </span>
          <span className="promo-banner__timer-block">
            <strong>{formatUnit(timeLeft.minutes)}</strong>
            <em>m</em>
          </span>
          <span className="promo-banner__timer-block">
            <strong>{formatUnit(timeLeft.seconds)}</strong>
            <em>s</em>
          </span>
        </div>

        <button
          type="button"
          onClick={() => {
            setDismissed(true);
            if (!dismissKey) {
              return;
            }

            try {
              window.localStorage.setItem(dismissKey, "1");
            } catch {
              // Ignore local storage failures.
            }
          }}
          className="promo-banner__close"
          aria-label="Dismiss launch week banner"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </section>
  );
}
