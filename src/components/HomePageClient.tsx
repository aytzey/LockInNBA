"use client";

import dynamic from "next/dynamic";
import { AnimatePresence } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { HomepageBootstrap } from "@/lib/homepage";
import Header from "@/components/Header";
import PromoBanner from "@/components/PromoBanner";
import SocialProofBanner from "@/components/SocialProofBanner";
import TonightsEdge from "@/components/TonightsEdge";
import GameCard from "@/components/GameCard";
import RestoreAccess from "@/components/RestoreAccess";
import ShareCard from "@/components/ShareCard";
import TrackRecord from "@/components/TrackRecord";
import { GameListSkeleton } from "@/components/LoadingSkeleton";
import type {
  ChatMessage,
  DailyPick,
  Game,
  PromoBanner as PromoBannerState,
  SiteCopy,
  TodayPrediction,
} from "@/components/types";
import { CHAT_SESSION_RESTORE_PREFIX, CHAT_TOKEN_PREFIX, DAILY_TOKEN_KEY } from "@/components/utils";
import { pollCheckoutStatus } from "@/components/api";

const ChatModal = dynamic(() => import("@/components/ChatModal"));
const SharePreviewModal = dynamic(() => import("@/components/SharePreviewModal"));

const LIVE_BOARD_POLL_MS = 20_000;
const ACTIVE_SLATE_POLL_MS = 5 * 60_000;
const QUIET_SLATE_POLL_MS = 15 * 60_000;
const EMPTY_BOARD_POLL_MS = 60_000;
const GAMES_FETCH_TIMEOUT_MS = 8_000;

type GamesResponse = {
  games?: Game[];
  updatedAt?: string;
};

type ShareStatus = "idle" | "generating" | "success" | "error";

function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number, externalSignal?: AbortSignal): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const signal = externalSignal
    ? AbortSignal.any([controller.signal, externalSignal])
    : controller.signal;
  return fetch(url, { ...options, signal }).finally(() => clearTimeout(timeoutId));
}

function jsonWithTimeout<T>(response: Response, timeoutMs: number): Promise<T | null> {
  return Promise.race([
    response.json() as Promise<T>,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ]);
}

function getShareFilename(mode: "daily" | "chat"): string {
  const timestamp = new Date().toISOString().slice(0, 10);
  return `lockin-${mode === "daily" ? "daily-edge" : "match-insight"}-${timestamp}.png`;
}

async function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }

      reject(new Error("Share card couldn't be generated. Please try again."));
    }, "image/png");
  });
}

function buildDailyShareHeadline(prediction: TodayPrediction | null): string {
  if (!prediction?.hasPrediction || prediction.pickCount <= 0) {
    return "LOCKIN Daily Edge";
  }

  return prediction.pickCount === 1
    ? "1 LOCKIN pick is live tonight."
    : `${prediction.pickCount} LOCKIN picks are live tonight.`;
}

interface HomePageClientProps {
  initialData: HomepageBootstrap;
}

export default function HomePageClient({ initialData }: HomePageClientProps) {
  const shareCardRef = useRef<HTMLDivElement>(null);
  const gameSectionRef = useRef<HTMLDivElement>(null);
  const trackRecordRef = useRef<HTMLDivElement>(null);
  const retryCountRef = useRef(0);
  const sharePreviewUrlRef = useRef<string | null>(null);

  const [hasMounted, setHasMounted] = useState(false);
  const [isBoardLoading, setIsBoardLoading] = useState(false);
  const [initError, setInitError] = useState(false);
  const [todayPrediction, setTodayPrediction] = useState<TodayPrediction | null>(initialData.prediction || null);
  const [socialProofMessages] = useState(initialData.socialProof.messages);
  const [siteCopy] = useState<SiteCopy>(initialData.siteCopy);
  const [promoBanner] = useState<PromoBannerState | null>(initialData.promoBanner);
  const [games, setGames] = useState<Game[]>(initialData.games || []);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(initialData.updatedAt || "");

  const [dailyMarkdown, setDailyMarkdown] = useState("");
  const [dailyUnlocked, setDailyUnlocked] = useState(false);
  const [dailyUnlockedPicks, setDailyUnlockedPicks] = useState<DailyPick[]>([]);

  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  const [isShareBusy, setIsShareBusy] = useState(false);
  const [shareMode, setShareMode] = useState<"daily" | "chat">("daily");
  const [shareStatus, setShareStatus] = useState<ShareStatus>("idle");
  const [sharePreviewUrl, setSharePreviewUrl] = useState<string | null>(null);
  const [shareBlob, setShareBlob] = useState<Blob | null>(null);
  const [shareErrorMessage, setShareErrorMessage] = useState("");
  const [sharePreviewMode, setSharePreviewMode] = useState<"daily" | "chat">("daily");
  const [isCopyingShare, setIsCopyingShare] = useState(false);

  const effectiveSocialProofMessages = useMemo(() => socialProofMessages.filter(Boolean), [socialProofMessages]);
  const isPromoActive = Boolean(promoBanner);
  const effectiveDailyCtaText = isPromoActive ? "Unlock Free Access" : siteCopy.dailyCtaText;
  const effectiveDailyPriceSubtext = isPromoActive
    ? "Email required for launch week access."
    : siteCopy.dailyPriceSubtext;
  const canCopyShareImage =
    hasMounted &&
    typeof navigator !== "undefined" &&
    typeof ClipboardItem !== "undefined" &&
    Boolean(navigator.clipboard?.write);
  const dailyShareHeadline = useMemo(() => buildDailyShareHeadline(todayPrediction), [todayPrediction]);

  const replaceSharePreviewUrl = useCallback((nextUrl: string | null) => {
    if (sharePreviewUrlRef.current) {
      URL.revokeObjectURL(sharePreviewUrlRef.current);
    }

    sharePreviewUrlRef.current = nextUrl;
    setSharePreviewUrl(nextUrl);
  }, []);

  const resetSharePreview = useCallback(() => {
    replaceSharePreviewUrl(null);
    setShareBlob(null);
    setShareErrorMessage("");
    setShareStatus("idle");
    setIsCopyingShare(false);
  }, [replaceSharePreviewUrl]);

  const fetchGames = useCallback(async () => {
    try {
      const response = await fetchWithTimeout("/api/games/today", { cache: "no-store" }, GAMES_FETCH_TIMEOUT_MS);
      if (!response.ok) {
        return null;
      }

      const body = await jsonWithTimeout<GamesResponse>(response, GAMES_FETCH_TIMEOUT_MS);
      if (!body) {
        return null;
      }

      const nextGames = Array.isArray(body.games) ? (body.games as Game[]) : null;
      if (nextGames) {
        setGames((currentGames) => {
          if (nextGames.length === 0 && currentGames.length > 0) {
            return currentGames;
          }

          return nextGames;
        });
      }

      if (body.updatedAt) {
        setLastUpdatedAt(body.updatedAt);
      } else if (nextGames && nextGames.length > 0) {
        setLastUpdatedAt(new Date().toISOString());
      }

      return body;
    } catch {
      return null;
    }
  }, []);

  const refreshDailyEdgePreview = useCallback(async () => {
    try {
      const response = await fetch("/api/predictions/today", { cache: "no-store" });
      if (!response.ok) {
        return;
      }

      const body = await response.json();
      if (body) {
        setTodayPrediction(body as TodayPrediction);
      }
    } catch {
      // Preview refresh is best-effort only.
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
          setDailyUnlockedPicks([]);
        }
        return;
      }

      setDailyMarkdown((body.markdown || "").toString());
      setDailyUnlockedPicks(Array.isArray(body.picks) ? (body.picks as DailyPick[]) : []);
      setDailyUnlocked(true);
    } catch {
      // keep existing state on network errors
    }
  }, []);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    return () => {
      if (sharePreviewUrlRef.current) {
        URL.revokeObjectURL(sharePreviewUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    async function hydrateAccess() {
      const params = new URLSearchParams(window.location.search);
      const checkoutSessionId = params.get("checkout_session");
      if (checkoutSessionId) {
        window.history.replaceState({}, "", "/");
        for (let attempt = 0; attempt < 20; attempt += 1) {
          if (signal.aborted) {
            return;
          }

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
              const restoredGame = games.find((game) => game.id === result.gameId);
              if (restoredGame) {
                setSelectedGame(restoredGame);
                setShareMode("chat");
              }
            }
            return;
          }

          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }

      const savedToken = window.localStorage.getItem(DAILY_TOKEN_KEY);
      if (savedToken) {
        await unlockDailyPrediction(savedToken);
      }
    }

    void hydrateAccess();

    return () => {
      controller.abort();
    };
  }, [games, unlockDailyPrediction]);

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
    if (dailyUnlocked) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void refreshDailyEdgePreview();
    }, 60_000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshDailyEdgePreview();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [dailyUnlocked, refreshDailyEdgePreview]);

  useEffect(() => {
    if (isBoardLoading || games.length > 0 || retryCountRef.current >= 2) {
      return;
    }

    const delayMs = retryCountRef.current === 0 ? 1500 : 4000;
    retryCountRef.current += 1;

    const timeoutId = window.setTimeout(async () => {
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
    void fetchGames().then(() => {
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
    if (!shareCardRef.current) {
      return;
    }

    const mode = nextMode || shareMode;
    if (mode === "daily" && dailyUnlockedPicks.length === 0) {
      return;
    }
    if (mode === "chat" && !chatMessages.some((message) => message.role === "assistant")) {
      setSharePreviewMode(mode);
      setShareBlob(null);
      replaceSharePreviewUrl(null);
      setShareErrorMessage("Share card couldn't be generated. Ask at least one matchup question first.");
      setShareStatus("error");
      return;
    }

    setIsShareBusy(true);
    setShareStatus("generating");
    setSharePreviewMode(mode);
    setShareErrorMessage("");
    setShareBlob(null);
    replaceSharePreviewUrl(null);
    if (nextMode) {
      setShareMode(nextMode);
      await new Promise((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));
    }

    try {
      if ("fonts" in document) {
        await document.fonts.ready;
      }
      const h2c = (await import("html2canvas")).default;
      const canvas = await Promise.race([
        h2c(shareCardRef.current, {
          backgroundColor: "#0A0E1A",
          scale: 2,
          useCORS: true,
          allowTaint: true,
          logging: false,
          imageTimeout: 4000,
          onclone: (documentClone) => {
            const clonedSurface = documentClone.getElementById("share-card-surface");
            if (clonedSurface instanceof HTMLElement) {
              clonedSurface.style.left = "0px";
              clonedSurface.style.top = "0px";
            }
          },
        }),
        new Promise<never>((_, reject) => {
          window.setTimeout(() => {
            reject(new Error("Share card couldn't be generated. Please try again."));
          }, 5000);
        }),
      ]);

      const blob = await canvasToBlob(canvas as HTMLCanvasElement);
      const objectUrl = URL.createObjectURL(blob);
      replaceSharePreviewUrl(objectUrl);
      setShareBlob(blob);
      setShareStatus("success");

      const anchor = document.createElement("a");
      anchor.download = getShareFilename(mode);
      anchor.href = objectUrl;
      anchor.click();
    } catch (error) {
      setShareErrorMessage(
        error instanceof Error ? error.message : "Share card couldn't be generated. Please try again.",
      );
      setShareStatus("error");
    } finally {
      setIsShareBusy(false);
    }
  }

  async function handleCopyShareImage() {
    if (!shareBlob || !canCopyShareImage) {
      return;
    }

    setIsCopyingShare(true);
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          [shareBlob.type]: shareBlob,
        }),
      ]);
    } catch {
      setShareErrorMessage("Copy image is not supported in this browser. Download the card instead.");
      setShareStatus("error");
    } finally {
      setIsCopyingShare(false);
    }
  }

  function handleDownloadShare() {
    if (!shareBlob) {
      return;
    }

    const objectUrl = URL.createObjectURL(shareBlob);
    const anchor = document.createElement("a");
    anchor.download = getShareFilename(sharePreviewMode);
    anchor.href = objectUrl;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  }

  function handleShareToX() {
    const shareText =
      sharePreviewMode === "daily"
        ? "LOCKIN Daily Edge just dropped. Track the board at lockinpicks.com"
        : selectedGame
          ? `LOCKIN AI just broke down ${selectedGame.awayTeam} @ ${selectedGame.homeTeam}. Full board at lockinpicks.com`
          : "LOCKIN AI matchup insight is live at lockinpicks.com";

    window.open(
      `https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}`,
      "_blank",
      "noopener,noreferrer",
    );
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

        {siteCopy.trackRecordMarkdown.trim() ? (
          <button
            type="button"
            onClick={() => trackRecordRef.current?.scrollIntoView({ behavior: "smooth" })}
            className="focus-ring mx-auto flex items-center gap-2 rounded-full border border-[color:var(--line)] bg-[color:var(--panel-soft)] px-4 py-2 text-[11px] uppercase tracking-[0.16em] text-[color:var(--silver-gray)] transition hover:border-[color:var(--money-green-line)] hover:text-[color:var(--money-green)]"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
            Show Track Record
          </button>
        ) : null}

        <TonightsEdge
          prediction={todayPrediction}
          isLoading={isBoardLoading && !dailyUnlocked}
          dailyUnlocked={dailyUnlocked}
          unlockedPicks={dailyUnlockedPicks}
          onUnlock={unlockDailyPrediction}
          onScrollToGames={() => gameSectionRef.current?.scrollIntoView({ behavior: "smooth" })}
          onShare={() => void handleShare("daily")}
          isShareBusy={isShareBusy}
          ctaText={effectiveDailyCtaText}
          priceSubtext={effectiveDailyPriceSubtext}
          noEdgeMessage={siteCopy.noEdgeMessage}
          isPromoActive={isPromoActive}
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
              <p className="text-sm text-[color:var(--silver-gray)]">All times shown in ET (New York).</p>
            </div>
            <div className="mono inline-flex items-center gap-2 rounded-full border border-[color:var(--line)] bg-[color:var(--panel-soft)] px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] text-[color:var(--silver-gray)] md:text-[11px]">
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${lastUpdatedLabel ? "bg-[color:var(--money-green)]" : "bg-[color:var(--gold)] animate-pulse"}`} />
              {lastUpdatedLabel ? `Updated ${lastUpdatedLabel}` : "Board refreshes at tip-off"}
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
                className="focus-ring mt-4 rounded-xl bg-[color:var(--money-green)] px-6 py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90"
              >
                Retry
              </button>
            </div>
          ) : games.length === 0 ? (
            <div className="empty-board-card">
              <div className="empty-board-card__eyebrow">BOARD STATUS</div>
              <h3 className="heading empty-board-card__title">Today&apos;s picks are being locked in.</h3>
              <p className="empty-board-card__body">Check back at 2 PM ET.</p>
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

        <div ref={trackRecordRef}>
          <TrackRecord markdown={siteCopy.trackRecordMarkdown} />
        </div>

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
          headline={dailyShareHeadline}
          dailyMarkdown={dailyMarkdown}
          selectedGame={selectedGame}
          chatMessages={chatMessages}
        />

        <AnimatePresence>
          {(shareStatus === "success" || shareStatus === "error") ? (
            <SharePreviewModal
              isOpen
              status={shareStatus === "success" ? "success" : "error"}
              mode={sharePreviewMode}
              imageUrl={sharePreviewUrl}
              errorMessage={shareErrorMessage}
              canCopyImage={canCopyShareImage}
              isCopying={isCopyingShare}
              onClose={resetSharePreview}
              onRetry={() => void handleShare(sharePreviewMode)}
              onDownload={handleDownloadShare}
              onCopyImage={() => void handleCopyShareImage()}
              onShareToX={handleShareToX}
            />
          ) : null}
        </AnimatePresence>
      </div>
    </main>
  );
}
