"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import Header from "@/components/Header";
import PromoBanner from "@/components/PromoBanner";
import SocialProofBanner from "@/components/SocialProofBanner";
import TonightsEdge from "@/components/TonightsEdge";
import GameCard from "@/components/GameCard";
import ChatModal from "@/components/ChatModal";
import RestoreAccess from "@/components/RestoreAccess";
import ShareCard from "@/components/ShareCard";
import { GameListSkeleton } from "@/components/LoadingSkeleton";
import type { Game, TodayPrediction, ChatMessage, SiteCopy, PromoBanner as PromoBannerState } from "@/components/types";
import { CHAT_SESSION_RESTORE_PREFIX, CHAT_TOKEN_PREFIX, DAILY_TOKEN_KEY } from "@/components/utils";
import { pollCheckoutStatus } from "@/components/api";

const LIVE_BOARD_POLL_MS = 20_000;
const ACTIVE_SLATE_POLL_MS = 5 * 60_000;
const QUIET_SLATE_POLL_MS = 15 * 60_000;
const EMPTY_BOARD_POLL_MS = 60_000;
const BOOTSTRAP_TIMEOUT_MS = 6_000;
const GAMES_FETCH_TIMEOUT_MS = 8_000;
const FALLBACK_FETCH_TIMEOUT_MS = 5_000;
const INIT_SAFETY_TIMEOUT_MS = 12_000;

function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number, externalSignal?: AbortSignal): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  // Forward external abort to our controller (Safari < 17.4 lacks AbortSignal.any)
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener("abort", () => controller.abort(), { once: true });
    }
  }
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timeoutId));
}

function jsonWithTimeout<T>(response: Response, timeoutMs: number): Promise<T | null> {
  return Promise.race([
    response.json() as Promise<T>,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ]);
}
const DEFAULT_SOCIAL_PROOF_MESSAGES = [
  "This Week: 5-0 (100%)",
  "+19.3u ROI",
  "We passed on 90% of this week's board",
];
const DEFAULT_SITE_COPY: SiteCopy = {
  dailyCtaText: "Unlock Tonight's Edge",
  dailyPriceSubtext: "$5 one-time pass",
  noEdgeMessage: "We passed on 90% of this week's games. We only bet when the math screams.",
  headerRightText: "",
  metaDescription: "LOCKIN is a premium AI sports analytics platform delivering nightly NBA moneyline analysis and per-game statistical insights.",
  footerDisclaimer:
    "For entertainment purposes only. LOCKIN does not accept wagers or guarantee outcomes. If you or someone you know has a gambling problem, call 1-800-GAMBLER.",
};

function splitTeaser(text: string): { headline: string; body: string } {
  const lines = text.split("\n").filter((line) => line.trim().length > 0);
  const headline = lines.slice(0, 2).join(" ") || "One game on tonight's slate just lit up every signal.";
  const body = lines.slice(2).join("\n");
  return { headline, body };
}

function normalizeSocialProofMessages(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? "").trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function buildSocialProofMessages(baseMessages: string[], isNoEdgeDay: boolean): string[] {
  const normalized = baseMessages.filter(Boolean);
  if (!isNoEdgeDay) {
    return normalized;
  }

  if (normalized.some((message) => message.startsWith("Today: No Edge"))) {
    return normalized;
  }

  return ["Today: No Edge — Protecting Your Bankroll", ...normalized];
}

export default function HomePage() {
  const shareCardRef = useRef<HTMLDivElement>(null);
  const gameSectionRef = useRef<HTMLDivElement>(null);
  const retryCountRef = useRef(0);

  const [hasMounted, setHasMounted] = useState(false);
  const [isBoardLoading, setIsBoardLoading] = useState(true);
  const [isPredictionLoading, setIsPredictionLoading] = useState(true);
  const [initError, setInitError] = useState(false);
  const [todayPrediction, setTodayPrediction] = useState<TodayPrediction | null>(null);
  const [socialProofMessages, setSocialProofMessages] = useState(DEFAULT_SOCIAL_PROOF_MESSAGES);
  const [siteCopy, setSiteCopy] = useState<SiteCopy>(DEFAULT_SITE_COPY);
  const [promoBanner, setPromoBanner] = useState<PromoBannerState | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [lastUpdatedAt, setLastUpdatedAt] = useState("");

  const [dailyMarkdown, setDailyMarkdown] = useState("");
  const [dailyUnlocked, setDailyUnlocked] = useState(false);

  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  const [isShareBusy, setIsShareBusy] = useState(false);
  const [shareMode, setShareMode] = useState<"daily" | "chat">("daily");

  const preview = splitTeaser(todayPrediction?.teaserText || "");
  const teaserGuardTerms = useMemo(
    () =>
      Array.from(
        new Set(
          games.flatMap((game) => [
            game.awayTeam,
            game.homeTeam,
            game.awayDisplayName,
            game.homeDisplayName,
            ...game.awayDisplayName.split(/\s+/),
            ...game.homeDisplayName.split(/\s+/),
          ]),
        ),
      ).filter((term) => term && term.length > 2),
    [games],
  );
  const effectiveSocialProofMessages = useMemo(
    () => buildSocialProofMessages(socialProofMessages, Boolean(todayPrediction?.isNoEdgeDay)),
    [socialProofMessages, todayPrediction?.isNoEdgeDay],
  );
  const isPromoActive = Boolean(promoBanner);
  const effectiveDailyCtaText = isPromoActive ? "Unlock Free" : siteCopy.dailyCtaText;
  const effectiveDailyPriceSubtext = isPromoActive ? "Launch week access. Email required." : siteCopy.dailyPriceSubtext;

  const fetchGames = useCallback(async () => {
    try {
      const response = await fetchWithTimeout("/api/games/today", { cache: "no-store" }, GAMES_FETCH_TIMEOUT_MS);
      if (!response.ok) {
        return null;
      }

      const body = await jsonWithTimeout(response, GAMES_FETCH_TIMEOUT_MS);
      if (!body) {
        return null;
      }
      const nextGames = Array.isArray(body?.games) ? (body.games as Game[]) : null;
      if (nextGames) {
        setGames((currentGames) => {
          if (nextGames.length === 0 && currentGames.length > 0) {
            return currentGames;
          }

          return nextGames;
        });
      }
      // Always update the timestamp on a successful API response so the UI
      // never stays stuck on "Waiting for live sync".
      if (body?.updatedAt) {
        setLastUpdatedAt(body.updatedAt);
      } else if (nextGames && nextGames.length > 0) {
        setLastUpdatedAt(new Date().toISOString());
      }
      return body;
    } catch (err) {
      console.warn("[LOCKIN] fetchGames failed:", err);
      return null;
    }
  }, []);

  const unlockDailyPrediction = useCallback(async (token: string) => {
    try {
      const res = await fetch("/api/predictions/unlock", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.json();
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          window.localStorage.removeItem(DAILY_TOKEN_KEY);
          setDailyUnlocked(false);
          setDailyMarkdown("");
        }
        return;
      }
      setDailyMarkdown(body.markdown || "");
      setDailyUnlocked(true);
    } catch {
      // keep existing state on network errors
    }
  }, []);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    const safetyTimeoutId = window.setTimeout(() => {
      if (!signal.aborted) {
        setIsBoardLoading(false);
        setIsPredictionLoading(false);
      }
    }, INIT_SAFETY_TIMEOUT_MS);

    async function init() {
      let initialGames: Game[] = [];

      const fallbackInit = async () => {
        console.warn("[LOCKIN] bootstrap unavailable, falling back to individual endpoints");
        const [gamesBody, predictionResponse, socialProofResponse, siteCopyResponse, promoBannerResponse] = await Promise.all([
          fetchGames(),
          fetchWithTimeout("/api/predictions/today", {}, FALLBACK_FETCH_TIMEOUT_MS, signal).catch((err: unknown) => { console.warn("[LOCKIN] fallback predictions failed:", err); return null; }),
          fetchWithTimeout("/api/social-proof", {}, FALLBACK_FETCH_TIMEOUT_MS, signal).catch((err: unknown) => { console.warn("[LOCKIN] fallback social-proof failed:", err); return null; }),
          fetchWithTimeout("/api/site-copy", {}, FALLBACK_FETCH_TIMEOUT_MS, signal).catch((err: unknown) => { console.warn("[LOCKIN] fallback site-copy failed:", err); return null; }),
          fetchWithTimeout("/api/promo-banner", {}, FALLBACK_FETCH_TIMEOUT_MS, signal).catch((err: unknown) => { console.warn("[LOCKIN] fallback promo-banner failed:", err); return null; }),
        ]);

        if (signal.aborted) return;

        initialGames = (gamesBody?.games as Game[] | undefined) || [];
        setIsBoardLoading(false);

        const [predictionBody, socialProofBody, siteCopyBody, promoBannerBody] = await Promise.all([
          predictionResponse?.ok ? jsonWithTimeout(predictionResponse, FALLBACK_FETCH_TIMEOUT_MS).catch(() => null) : Promise.resolve(null),
          socialProofResponse?.ok ? jsonWithTimeout(socialProofResponse, FALLBACK_FETCH_TIMEOUT_MS).catch(() => null) : Promise.resolve(null),
          siteCopyResponse?.ok ? jsonWithTimeout(siteCopyResponse, FALLBACK_FETCH_TIMEOUT_MS).catch(() => null) : Promise.resolve(null),
          promoBannerResponse?.ok ? jsonWithTimeout(promoBannerResponse, FALLBACK_FETCH_TIMEOUT_MS).catch(() => null) : Promise.resolve(null),
        ]);

        if (signal.aborted) return;

        if (predictionBody) {
          setTodayPrediction(predictionBody);
        }
        setSocialProofMessages(
          normalizeSocialProofMessages(socialProofBody?.messages).length > 0
            ? normalizeSocialProofMessages(socialProofBody?.messages)
            : normalizeSocialProofMessages(socialProofBody?.text).length > 0
              ? normalizeSocialProofMessages(socialProofBody?.text)
              : DEFAULT_SOCIAL_PROOF_MESSAGES,
        );
        setSiteCopy({
          dailyCtaText: siteCopyBody?.dailyCtaText || DEFAULT_SITE_COPY.dailyCtaText,
          dailyPriceSubtext: siteCopyBody?.dailyPriceSubtext || DEFAULT_SITE_COPY.dailyPriceSubtext,
          noEdgeMessage: siteCopyBody?.noEdgeMessage || DEFAULT_SITE_COPY.noEdgeMessage,
          headerRightText: siteCopyBody?.headerRightText || DEFAULT_SITE_COPY.headerRightText,
          metaDescription: siteCopyBody?.metaDescription || DEFAULT_SITE_COPY.metaDescription,
          footerDisclaimer: siteCopyBody?.footerDisclaimer || DEFAULT_SITE_COPY.footerDisclaimer,
        });
        setPromoBanner(promoBannerBody?.promoBanner || null);
        setIsPredictionLoading(false);
      };

      try {
        const bootstrapResponse = await fetchWithTimeout("/api/bootstrap", { cache: "no-store" }, BOOTSTRAP_TIMEOUT_MS, signal).catch(() => null);
        if (signal.aborted) return;

        if (!bootstrapResponse?.ok) {
          await fallbackInit();
        } else {
          const bootstrap = await jsonWithTimeout(bootstrapResponse, BOOTSTRAP_TIMEOUT_MS).catch(() => null);
          if (signal.aborted) return;

          if (!bootstrap) {
            await fallbackInit();
          } else {
            initialGames = (bootstrap.games as Game[] | undefined) || [];
            setGames(initialGames);
            setLastUpdatedAt(bootstrap.updatedAt || new Date().toISOString());
            setTodayPrediction(bootstrap.prediction || null);
            setSocialProofMessages(
              normalizeSocialProofMessages(bootstrap.socialProof?.messages).length > 0
                ? normalizeSocialProofMessages(bootstrap.socialProof?.messages)
                : normalizeSocialProofMessages(bootstrap.socialProof?.text).length > 0
                  ? normalizeSocialProofMessages(bootstrap.socialProof?.text)
                  : DEFAULT_SOCIAL_PROOF_MESSAGES,
            );
            setSiteCopy({
              dailyCtaText: bootstrap.siteCopy?.dailyCtaText || DEFAULT_SITE_COPY.dailyCtaText,
              dailyPriceSubtext: bootstrap.siteCopy?.dailyPriceSubtext || DEFAULT_SITE_COPY.dailyPriceSubtext,
              noEdgeMessage: bootstrap.siteCopy?.noEdgeMessage || DEFAULT_SITE_COPY.noEdgeMessage,
              headerRightText: bootstrap.siteCopy?.headerRightText || DEFAULT_SITE_COPY.headerRightText,
              metaDescription: bootstrap.siteCopy?.metaDescription || DEFAULT_SITE_COPY.metaDescription,
              footerDisclaimer: bootstrap.siteCopy?.footerDisclaimer || DEFAULT_SITE_COPY.footerDisclaimer,
            });
            setPromoBanner(bootstrap.promoBanner || null);
            setIsPredictionLoading(false);
            setIsBoardLoading(false);
          }
        }

        if (signal.aborted) return;

        const params = new URLSearchParams(window.location.search);
        const checkoutSessionId = params.get("checkout_session");
        if (checkoutSessionId) {
          window.history.replaceState({}, "", "/");
          const poll = async () => {
            for (let attempt = 0; attempt < 20; attempt += 1) {
              if (signal.aborted) return;
              const result = await pollCheckoutStatus(checkoutSessionId).catch(() => null);
              if (result?.accessToken) {
                if (result.type === "daily_pick") {
                  window.localStorage.setItem(DAILY_TOKEN_KEY, result.accessToken);
                  await unlockDailyPrediction(result.accessToken);
                  return;
                }

                if (result.chatSessionId && result.gameId) {
                  window.localStorage.setItem(`${CHAT_TOKEN_PREFIX}${result.chatSessionId}`, result.accessToken);
                  window.localStorage.setItem(`${CHAT_SESSION_RESTORE_PREFIX}${result.gameId}`, result.chatSessionId);
                  const restoredGame = initialGames.find(
                    (game) => game.id === result.gameId,
                  );
                  if (restoredGame) {
                    setSelectedGame(restoredGame);
                    setShareMode("chat");
                  }
                }
                return;
              }

              await new Promise((resolve) => setTimeout(resolve, 2000));
            }
          };
          void poll();
        }

        const savedToken = window.localStorage.getItem(DAILY_TOKEN_KEY);
        if (savedToken) {
          await unlockDailyPrediction(savedToken);
        }
      } finally {
        if (!signal.aborted) {
          setIsBoardLoading(false);
          setIsPredictionLoading(false);
        }
      }
    }

    void init().catch((err) => {
      console.warn("[LOCKIN] init failed:", err);
      if (!signal.aborted) {
        setIsBoardLoading(false);
        setIsPredictionLoading(false);
      }
    });

    return () => {
      controller.abort();
      window.clearTimeout(safetyTimeoutId);
    };
  }, [fetchGames, unlockDailyPrediction]);

  useEffect(() => {
    if (isBoardLoading) {
      return;
    }

    const hasLiveGames = games.some((game) => game.status === "live");
    const hasActiveSlate = hasLiveGames || games.some((game) => game.status === "upcoming");
    const intervalMs = games.length === 0
      ? EMPTY_BOARD_POLL_MS
      : hasLiveGames
        ? LIVE_BOARD_POLL_MS
        : hasActiveSlate
          ? ACTIVE_SLATE_POLL_MS
          : QUIET_SLATE_POLL_MS;

    const refreshGames = async () => {
      if (document.visibilityState === "hidden") {
        return;
      }

      await fetchGames();
    };

    const intervalId = window.setInterval(() => {
      void refreshGames();
    }, intervalMs);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void fetchGames();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchGames, games, isBoardLoading]);

  useEffect(() => {
    if (isBoardLoading || games.length > 0 || retryCountRef.current >= 2) {
      return;
    }

    const delayMs = retryCountRef.current === 0 ? 1500 : 4000;
    const attempt = retryCountRef.current;
    retryCountRef.current += 1;

    const timeoutId = window.setTimeout(async () => {
      console.warn(`[LOCKIN] auto-retry ${attempt + 1}/2 for empty board`);
      const result = await fetchGames();
      const loaded = Array.isArray(result?.games) && result.games.length > 0;
      if (!loaded && retryCountRef.current >= 2) {
        setInitError(true);
      }
    }, delayMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [fetchGames, games.length, isBoardLoading]);

  useEffect(() => {
    if (!selectedGame) {
      return;
    }

    const nextSelectedGame = games.find((game) => game.id === selectedGame.id);
    if (!nextSelectedGame) {
      return;
    }

    const scoreChanged =
      nextSelectedGame.awayScore !== selectedGame.awayScore ||
      nextSelectedGame.homeScore !== selectedGame.homeScore ||
      nextSelectedGame.status !== selectedGame.status ||
      nextSelectedGame.statusDetail !== selectedGame.statusDetail;

    if (scoreChanged) {
      setSelectedGame(nextSelectedGame);
    }
  }, [games, selectedGame]);

  function handleRetry() {
    setInitError(false);
    setIsBoardLoading(true);
    retryCountRef.current = 0;
    void fetchGames().finally(() => {
      setIsBoardLoading(false);
    });
  }

  function handleOpenChat(game: Game) {
    setSelectedGame(game);
    setShareMode("chat");
    setChatMessages([]);
  }

  function handleCloseChat() {
    setSelectedGame(null);
    setChatMessages([]);
  }

  async function handleShare(nextMode?: "daily" | "chat") {
    if (!shareCardRef.current) return;
    const mode = nextMode || shareMode;
    if (mode === "daily" && !dailyUnlocked) return;

    setIsShareBusy(true);
    if (nextMode) {
      setShareMode(nextMode);
      await new Promise((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));
    }
    try {
      const h2c = (await import("html2canvas")).default;
      const canvas = await h2c(shareCardRef.current, { backgroundColor: "#0A0E1A", scale: 2 });
      const anchor = document.createElement("a");
      anchor.download = `lockin-insight-${Date.now()}.png`;
      anchor.href = canvas.toDataURL("image/png");
      anchor.click();
    } catch {
      // share card generation failed silently
    } finally {
      setIsShareBusy(false);
    }
  }

  const liveGames = games.filter((game) => game.status === "live");
  const upcomingGames = games.filter((game) => game.status === "upcoming");
  const finalGames = games.filter((game) => game.status === "final");

  const lastUpdatedLabel = lastUpdatedAt
    ? new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(new Date(lastUpdatedAt))
    : "";

  function renderGameSection(sectionGames: Game[]) {
    return sectionGames.map((game) => (
      <GameCard
        key={game.id}
        game={game}
        onOpenChat={handleOpenChat}
        promoActive={isPromoActive}
      />
    ));
  }

  return (
    <main className="noise-overlay min-h-screen">
      <div className="aurora-bg" />
      <PromoBanner promoBanner={promoBanner} />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col gap-4 px-3 py-4 pb-12 md:gap-8 md:px-8 md:py-8 md:pb-16">
        <Header note={siteCopy.headerRightText} />

        <SocialProofBanner messages={effectiveSocialProofMessages} />

        <TonightsEdge
          prediction={todayPrediction}
          isLoading={hasMounted && isPredictionLoading && !dailyUnlocked}
          dailyUnlocked={dailyUnlocked}
          dailyMarkdown={dailyMarkdown}
          onUnlock={unlockDailyPrediction}
          onScrollToGames={() => gameSectionRef.current?.scrollIntoView({ behavior: "smooth" })}
          onShare={() => void handleShare("daily")}
          isShareBusy={isShareBusy}
          ctaText={effectiveDailyCtaText}
          priceSubtext={effectiveDailyPriceSubtext}
          noEdgeMessage={siteCopy.noEdgeMessage}
          isPromoActive={isPromoActive}
          teaserGuardTerms={teaserGuardTerms}
        />

        <section ref={gameSectionRef} className="space-y-4 md:space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-3 md:gap-4">
            <div className="space-y-1 md:space-y-2">
              <h2 className="heading text-[1.3rem] text-[color:var(--pure-white)] md:text-[2.1rem]">
                Tonight&apos;s Matchups
              </h2>
              <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--silver-gray)]">
                Moneyline board only
              </p>
            </div>
            <div className="mono inline-flex items-center gap-2 rounded-full border border-[color:var(--line)] bg-[color:var(--panel-soft)] px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] text-[color:var(--silver-gray)] md:text-[11px]">
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${lastUpdatedLabel ? "bg-[color:var(--money-green)]" : "bg-[color:var(--gold)] animate-pulse"}`} />
              {lastUpdatedLabel ? `Updated ${lastUpdatedLabel} ET` : "Syncing board"}
            </div>
          </div>

          {isBoardLoading && hasMounted ? (
            <GameListSkeleton />
          ) : games.length === 0 && initError ? (
            <div className="empty-board-card">
              <div className="empty-board-card__eyebrow">CONNECTION ISSUE</div>
              <h3 className="heading empty-board-card__title">Couldn&apos;t load tonight&apos;s board.</h3>
              <p className="empty-board-card__body">Tap below to try again.</p>
              <button
                onClick={handleRetry}
                className="mt-4 rounded-xl bg-[color:var(--money-green)] px-6 py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90"
              >
                Retry
              </button>
            </div>
          ) : games.length === 0 ? (
            <div className="empty-board-card">
              <div className="empty-board-card__eyebrow">BOARD STATUS</div>
              <h3 className="heading empty-board-card__title">Today&apos;s picks are being locked in.</h3>
              <p className="empty-board-card__body">Check back at 2 PM EST.</p>
            </div>
          ) : (
            <div className="space-y-5 md:space-y-8">
              {liveGames.length > 0 ? (
                <div className="space-y-3 md:space-y-4">
                  <div className="board-group-label board-group-label--live">
                    <span className="live-dot" />
                    LIVE
                  </div>
                  <div className="grid gap-3 md:gap-5 xl:grid-cols-2">
                    {renderGameSection(liveGames)}
                  </div>
                </div>
              ) : null}

              {upcomingGames.length > 0 ? (
                <div className="space-y-3 md:space-y-4">
                  <div className="board-group-label">UPCOMING</div>
                  <div className="grid gap-3 md:gap-5 xl:grid-cols-2">
                    {renderGameSection(upcomingGames)}
                  </div>
                </div>
              ) : null}

              {finalGames.length > 0 ? (
                <div className="space-y-3 md:space-y-4">
                  <div className="board-group-label">FINAL</div>
                  <div className="grid gap-3 md:gap-5 xl:grid-cols-2">
                    {renderGameSection(finalGames)}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </section>

        <RestoreAccess onRestore={unlockDailyPrediction} footerDisclaimer={siteCopy.footerDisclaimer} />

        <AnimatePresence>
          {selectedGame ? (
            <ChatModal
              game={selectedGame}
              promoActive={isPromoActive}
              onClose={handleCloseChat}
              onShareRequest={() => void handleShare("chat")}
              isShareBusy={isShareBusy}
              onMessagesChange={setChatMessages}
            />
          ) : null}
        </AnimatePresence>

        <ShareCard
          ref={shareCardRef}
          mode={shareMode}
          headline={preview.headline}
          dailyMarkdown={dailyMarkdown}
          selectedGame={selectedGame}
          chatMessages={chatMessages}
        />
      </div>
    </main>
  );
}
