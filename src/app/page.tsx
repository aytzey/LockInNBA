"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Header from "@/components/Header";
import SocialProofBanner from "@/components/SocialProofBanner";
import TonightsEdge from "@/components/TonightsEdge";
import GameCard from "@/components/GameCard";
import ChatModal from "@/components/ChatModal";
import RestoreAccess from "@/components/RestoreAccess";
import ShareCard from "@/components/ShareCard";
import { GameListSkeleton } from "@/components/LoadingSkeleton";
import type { Game, TodayPrediction, ChatMessage, SiteCopy } from "@/components/types";
import { CHAT_SESSION_RESTORE_PREFIX, CHAT_TOKEN_PREFIX, DAILY_TOKEN_KEY } from "@/components/utils";
import { pollCheckoutStatus } from "@/components/api";

const LIVE_BOARD_POLL_MS = 20_000;
const ACTIVE_SLATE_POLL_MS = 90_000;
const QUIET_SLATE_POLL_MS = 5 * 60_000;
const DEFAULT_SOCIAL_PROOF = "This Week: 5-0 (100%) | +19.3u ROI";
const DEFAULT_SITE_COPY: SiteCopy = {
  dailyCtaText: "Unlock Tonight's Edge — $5",
  noEdgeMessage: "We passed on 90% of this week's games. We only bet when the math screams.",
  headerRightText: "",
  footerDisclaimer:
    "For entertainment purposes only. LOCKIN does not accept wagers or guarantee outcomes. If you or someone you know has a gambling problem, call 1-800-GAMBLER.",
};

function splitTeaser(text: string): { headline: string; body: string } {
  const lines = text.split("\n").filter((line) => line.trim().length > 0);
  const headline = lines.slice(0, 2).join(" ") || "Our engine went 5-0 this week. Tonight's edge is ready.";
  const body = lines.slice(2).join("\n");
  return { headline, body };
}

function buildSocialProof(baseText: string, isNoEdgeDay: boolean): string {
  if (!isNoEdgeDay) {
    return baseText;
  }

  if (baseText.startsWith("Today: No Edge")) {
    return baseText;
  }

  return `Today: No Edge — Protecting Your Bankroll | ${baseText}`;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  },
};

const gameCardVariants = {
  hidden: { opacity: 0, y: 10, scale: 0.98 },
  visible: (index: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.32,
      delay: index * 0.05,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  }),
};

export default function HomePage() {
  const shareCardRef = useRef<HTMLDivElement>(null);
  const gameSectionRef = useRef<HTMLDivElement>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [todayPrediction, setTodayPrediction] = useState<TodayPrediction | null>(null);
  const [socialProofBase, setSocialProofBase] = useState(DEFAULT_SOCIAL_PROOF);
  const [siteCopy, setSiteCopy] = useState<SiteCopy>(DEFAULT_SITE_COPY);
  const [games, setGames] = useState<Game[]>([]);
  const [lastUpdatedAt, setLastUpdatedAt] = useState("");

  const [dailyMarkdown, setDailyMarkdown] = useState("");
  const [dailyUnlocked, setDailyUnlocked] = useState(false);

  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  const [isShareBusy, setIsShareBusy] = useState(false);
  const [shareMode, setShareMode] = useState<"daily" | "chat">("daily");

  const preview = splitTeaser(todayPrediction?.teaserText || "");
  const effectiveSocialProof = useMemo(
    () => buildSocialProof(socialProofBase, Boolean(todayPrediction?.isNoEdgeDay)),
    [socialProofBase, todayPrediction?.isNoEdgeDay],
  );

  const fetchGames = useCallback(async () => {
    try {
      const response = await fetch("/api/games/today", { cache: "no-store" });
      if (!response.ok) {
        return null;
      }

      const body = await response.json();
      if (body?.games) {
        setGames(body.games);
      }
      setLastUpdatedAt(body?.updatedAt || new Date().toISOString());
      return body;
    } catch {
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
    async function init() {
      try {
        const [predictionResponse, gamesBody, socialProofResponse, siteCopyResponse] = await Promise.all([
          fetch("/api/predictions/today"),
          fetchGames(),
          fetch("/api/social-proof"),
          fetch("/api/site-copy"),
        ]);
        const [predictionBody, socialProofBody, siteCopyBody] = await Promise.all([
          predictionResponse.ok ? predictionResponse.json() : Promise.resolve(null),
          socialProofResponse.ok ? socialProofResponse.json() : Promise.resolve(null),
          siteCopyResponse.ok ? siteCopyResponse.json() : Promise.resolve(null),
        ]);

        if (predictionBody) {
          setTodayPrediction(predictionBody);
        }
        setSocialProofBase(socialProofBody?.text || DEFAULT_SOCIAL_PROOF);
        setSiteCopy({
          dailyCtaText: siteCopyBody?.dailyCtaText || DEFAULT_SITE_COPY.dailyCtaText,
          noEdgeMessage: siteCopyBody?.noEdgeMessage || DEFAULT_SITE_COPY.noEdgeMessage,
          headerRightText: siteCopyBody?.headerRightText || DEFAULT_SITE_COPY.headerRightText,
          footerDisclaimer: siteCopyBody?.footerDisclaimer || DEFAULT_SITE_COPY.footerDisclaimer,
        });

        const params = new URLSearchParams(window.location.search);
        const checkoutSessionId = params.get("checkout_session");
        if (checkoutSessionId) {
          window.history.replaceState({}, "", "/");
          const poll = async () => {
            for (let attempt = 0; attempt < 20; attempt += 1) {
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
                  const restoredGame = ((gamesBody?.games as Game[] | undefined) || []).find(
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
        setIsLoading(false);
      }
    }

    void init().catch(() => setIsLoading(false));
  }, [fetchGames, unlockDailyPrediction]);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    const hasLiveGames = games.some((game) => game.status === "live");
    const hasActiveSlate = hasLiveGames || games.some((game) => game.status === "upcoming");
    const intervalMs = hasLiveGames
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
  }, [fetchGames, games, isLoading]);

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

  function renderGameSection(sectionGames: Game[], startIndex: number) {
    return sectionGames.map((game, index) => (
      <motion.div
        key={game.id}
        custom={startIndex + index}
        variants={gameCardVariants}
        initial="hidden"
        animate="visible"
      >
        <GameCard game={game} onOpenChat={handleOpenChat} />
      </motion.div>
    ));
  }

  return (
    <main className="noise-overlay min-h-screen">
      <div className="aurora-bg" />

      <motion.div
        className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-6 pb-16 md:gap-8 md:px-8 md:py-8"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={itemVariants}>
          <Header note={siteCopy.headerRightText} />
        </motion.div>

        <motion.div variants={itemVariants}>
          <SocialProofBanner text={effectiveSocialProof} />
        </motion.div>

        <motion.div variants={itemVariants}>
          <TonightsEdge
            prediction={todayPrediction}
            isLoading={isLoading}
            dailyUnlocked={dailyUnlocked}
            dailyMarkdown={dailyMarkdown}
            onUnlock={unlockDailyPrediction}
            onScrollToGames={() => gameSectionRef.current?.scrollIntoView({ behavior: "smooth" })}
            onShare={() => void handleShare("daily")}
            isShareBusy={isShareBusy}
            ctaText={siteCopy.dailyCtaText}
            noEdgeMessage={siteCopy.noEdgeMessage}
          />
        </motion.div>

        <motion.section ref={gameSectionRef} className="space-y-5 md:space-y-6" variants={itemVariants}>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-2">
              <h2 className="heading text-[1.6rem] text-[color:var(--pure-white)] md:text-[1.9rem]">
                Tonight&apos;s Matchups
              </h2>
              <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--silver-gray)]">
                Moneyline board only
              </p>
            </div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--silver-gray)]">
              {lastUpdatedLabel ? `Updated ${lastUpdatedLabel} ET` : "Waiting for live sync"}
            </div>
          </div>

          {isLoading ? (
            <GameListSkeleton />
          ) : games.length === 0 ? (
            <div className="empty-board-card">
              <div className="empty-board-card__eyebrow">BOARD STATUS</div>
              <h3 className="heading empty-board-card__title">Today&apos;s picks are being locked in.</h3>
              <p className="empty-board-card__body">Check back at 2 PM EST.</p>
            </div>
          ) : (
            <div className="space-y-6 md:space-y-8">
              {liveGames.length > 0 ? (
                <div className="space-y-4">
                  <div className="board-group-label board-group-label--live">
                    <span className="live-dot" />
                    LIVE
                  </div>
                  <div className="grid gap-4 xl:grid-cols-2">
                    {renderGameSection(liveGames, 0)}
                  </div>
                </div>
              ) : null}

              {upcomingGames.length > 0 ? (
                <div className="space-y-4">
                  <div className="board-group-label">UPCOMING</div>
                  <div className="grid gap-4 xl:grid-cols-2">
                    {renderGameSection(upcomingGames, liveGames.length)}
                  </div>
                </div>
              ) : null}

              {finalGames.length > 0 ? (
                <div className="space-y-4">
                  <div className="board-group-label">FINAL</div>
                  <div className="grid gap-4 xl:grid-cols-2">
                    {renderGameSection(finalGames, liveGames.length + upcomingGames.length)}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </motion.section>

        <motion.div variants={itemVariants}>
          <RestoreAccess onRestore={unlockDailyPrediction} footerDisclaimer={siteCopy.footerDisclaimer} />
        </motion.div>

        <AnimatePresence>
          {selectedGame ? (
            <ChatModal
              game={selectedGame}
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
      </motion.div>
    </main>
  );
}
