"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Header from "@/components/Header";
import SocialProofBanner from "@/components/SocialProofBanner";
import TonightsEdge from "@/components/TonightsEdge";
import GameCard from "@/components/GameCard";
import ChatModal from "@/components/ChatModal";
import RestoreAccess from "@/components/RestoreAccess";
import ShareCard from "@/components/ShareCard";
import { GameListSkeleton } from "@/components/LoadingSkeleton";
import type { Game, TodayPrediction, ChatMessage } from "@/components/types";
import { DAILY_TOKEN_KEY } from "@/components/utils";
import { pollCheckoutStatus } from "@/components/api";

function splitTeaser(text: string): { headline: string; body: string } {
  const lines = text.split("\n").filter((line) => line.trim().length > 0);
  const headline = lines.slice(0, 2).join(" ") || "Today's board is being filtered for the cleanest moneyline lane.";
  const body = lines.slice(2).join("\n") || "The full report stays locked until daily access is opened.";
  return { headline, body };
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  },
};

const gameCardVariants = {
  hidden: { opacity: 0, y: 12, scale: 0.98 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.35,
      delay: i * 0.06,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  }),
};

const LIVE_BOARD_POLL_MS = 20_000;
const ACTIVE_SLATE_POLL_MS = 90_000;
const QUIET_SLATE_POLL_MS = 5 * 60_000;

export default function HomePage() {
  const shareCardRef = useRef<HTMLDivElement>(null);
  const gameSectionRef = useRef<HTMLDivElement>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [todayPrediction, setTodayPrediction] = useState<TodayPrediction | null>(null);
  const [socialProof, setSocialProof] = useState("");
  const [games, setGames] = useState<Game[]>([]);
  const [lastUpdatedAt, setLastUpdatedAt] = useState("");

  const [dailyMarkdown, setDailyMarkdown] = useState("");
  const [dailyUnlocked, setDailyUnlocked] = useState(false);

  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  const [isShareBusy, setIsShareBusy] = useState(false);
  const [shareMode, setShareMode] = useState<"daily" | "chat">("daily");

  const preview = splitTeaser(todayPrediction?.teaserText || "");

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
      // network error — silently fail
    }
  }, []);

  useEffect(() => {
    async function init() {
      try {
        const [pRes, , bRes] = await Promise.all([
          fetch("/api/predictions/today"),
          fetchGames(),
          fetch("/api/social-proof"),
        ]);
        const [pBody, bBody] = await Promise.all([
          pRes.ok ? pRes.json() : Promise.resolve(null),
          bRes.ok ? bRes.json() : Promise.resolve(null),
        ]);
        if (pBody) setTodayPrediction(pBody);
        setSocialProof(bBody?.text || "");

        // Handle return from Lemon Squeezy checkout (redirect fallback)
        const params = new URLSearchParams(window.location.search);
        const checkoutSessionId = params.get("checkout_session");
        if (checkoutSessionId) {
          // Clean the URL
          window.history.replaceState({}, "", "/");
          // Poll for payment completion
          const poll = async () => {
            for (let i = 0; i < 20; i++) {
              const token = await pollCheckoutStatus(checkoutSessionId).catch(() => null);
              if (token) {
                window.localStorage.setItem(DAILY_TOKEN_KEY, token);
                await unlockDailyPrediction(token);
                return;
              }
              await new Promise((r) => setTimeout(r, 2000));
            }
          };
          poll();
        }

        const savedToken = window.localStorage.getItem(DAILY_TOKEN_KEY);
        if (savedToken) {
          await unlockDailyPrediction(savedToken);
        }
      } finally {
        setIsLoading(false);
      }
    }

    init().catch(() => setIsLoading(false));
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

  async function handleShare() {
    if (!shareCardRef.current) return;
    if (shareMode === "daily" && !dailyUnlocked) return;

    setIsShareBusy(true);
    try {
      const h2c = (await import("html2canvas")).default;
      const canvas = await h2c(shareCardRef.current, { backgroundColor: "#0a0e1a", scale: 2 });
      const anchor = document.createElement("a");
      anchor.download = `lockin-insight-${Date.now()}.png`;
      anchor.href = canvas.toDataURL("image/png");
      anchor.click();
    } catch {
      // could not generate card
    } finally {
      setIsShareBusy(false);
    }
  }

  const liveGames = games.filter((g) => g.status === "live");
  const upcomingGames = games.filter((g) => g.status === "upcoming");
  const finalGames = games.filter((g) => g.status === "final");
  const spotlightGames = [...liveGames, ...upcomingGames, ...finalGames].slice(0, 3);

  const lastUpdatedLabel = lastUpdatedAt
    ? new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(lastUpdatedAt))
    : "";

  function renderGameSection(sectionGames: Game[], startIndex: number) {
    return sectionGames.map((game, i) => (
      <motion.div
        key={game.id}
        custom={startIndex + i}
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
      {/* Aurora ambient background */}
      <div className="aurora-bg" />

      <motion.div
        className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col gap-5 px-4 py-6 pb-16 text-sm md:px-8"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={itemVariants}>
          <Header />
        </motion.div>

        <AnimatePresence>
          {socialProof && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
            >
              <SocialProofBanner text={socialProof} />
            </motion.div>
          )}
        </AnimatePresence>

        <motion.section className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]" variants={itemVariants}>
          <TonightsEdge
            prediction={todayPrediction}
            isLoading={isLoading}
            dailyUnlocked={dailyUnlocked}
            dailyMarkdown={dailyMarkdown}
            onUnlock={unlockDailyPrediction}
            onScrollToGames={() => gameSectionRef.current?.scrollIntoView({ behavior: "smooth" })}
            onShare={() => {
              setShareMode("daily");
              handleShare();
            }}
            isShareBusy={isShareBusy}
          />

          <aside className="slate-panel relative overflow-hidden rounded-[1.75rem] p-5 md:p-6">
            <div className="slate-panel__glow" />
            <div className="relative space-y-5">
              <div>
                <p className="section-kicker">Slate pulse</p>
                <h2 className="heading mt-2 text-[1.6rem] leading-none text-white">Tonight&apos;s board, read fast</h2>
                <p className="mt-2 max-w-sm text-sm text-[var(--muted)]">
                  Real-time NBA games, moneylines and broadcast context pulled into the board before the chat opens.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="slate-stat">
                  <span className="slate-stat__value">{liveGames.length}</span>
                  <span className="slate-stat__label">Live</span>
                </div>
                <div className="slate-stat">
                  <span className="slate-stat__value">{upcomingGames.length}</span>
                  <span className="slate-stat__label">Upcoming</span>
                </div>
                <div className="slate-stat">
                  <span className="slate-stat__value">{finalGames.length}</span>
                  <span className="slate-stat__label">Final</span>
                </div>
              </div>

              <div className="space-y-3">
                {spotlightGames.length > 0 ? spotlightGames.map((game) => (
                  <button
                    key={game.id}
                    type="button"
                    onClick={() => handleOpenChat(game)}
                    className="slate-spotlight group w-full text-left"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="heading text-base text-white">{game.awayTeam} @ {game.homeTeam}</p>
                        <p className="mt-1 text-xs text-[var(--muted)]">{game.statusDetail}</p>
                      </div>
                      <span className={`slate-status-pill ${game.status === "live" ? "slate-status-pill--live" : ""}`}>
                        {game.status}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-[var(--muted)]">
                      {(game.status === "live" || game.status === "final") && game.awayScore !== null && game.homeScore !== null && (
                        <span className="chip">
                          {game.awayTeam} {game.awayScore} - {game.homeScore} {game.homeTeam}
                        </span>
                      )}
                      <span className="chip">{game.awayTeam} {game.awayMoneyline > 0 ? `+${game.awayMoneyline}` : game.awayMoneyline || "OFF"}</span>
                      <span className="chip">{game.homeTeam} {game.homeMoneyline > 0 ? `+${game.homeMoneyline}` : game.homeMoneyline || "OFF"}</span>
                      <span className="chip">{game.spread}</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-[var(--muted)]">
                      <span>{game.broadcast}</span>
                      <span>{game.venue}</span>
                    </div>
                  </button>
                )) : (
                  <div className="rounded-[1.35rem] border border-[color:var(--line)] bg-[color:var(--panel-soft)] p-4 text-sm text-[var(--muted)]">
                    Today&apos;s NBA board is currently empty. The next slate will appear here as soon as ESPN posts it.
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-[color:var(--line)] pt-4 text-xs text-[var(--muted)]">
                <span>Verified from live scoreboard and market feed.</span>
                <span>{lastUpdatedLabel ? `Updated ${lastUpdatedLabel} ET` : "Waiting for sync"}</span>
              </div>
            </div>
          </aside>
        </motion.section>

        <motion.section ref={gameSectionRef} className="space-y-4" variants={itemVariants}>
          <div>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="heading text-[1.8rem] text-white">Tonight&apos;s Matchups</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Moneyline board only. Open any matchup for a paid AI read built from the live slate context.
                </p>
              </div>
              <button
                type="button"
                onClick={() => gameSectionRef.current?.scrollIntoView({ behavior: "smooth" })}
                className="ghost-button"
              >
                Scan the board
              </button>
            </div>
            <p className="mt-3 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.2em] text-[var(--muted)]">
              <span className="chip">American odds</span>
              <span className="chip">Live scoreboard</span>
              <span className="chip">Ask the model per matchup</span>
            </p>
          </div>

          {isLoading ? (
            <GameListSkeleton />
          ) : games.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="overflow-hidden rounded-[1.75rem] border border-[color:var(--line)] bg-[color:var(--panel)] p-10 text-center shadow-[var(--shadow-soft)]"
            >
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[color:var(--amber-soft)] ring-1 ring-[color:var(--amber-line)]">
                <svg className="h-8 w-8 text-[#ff6b35]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="heading text-base font-semibold text-white">No games scheduled for today</p>
              <p className="mt-2 text-sm text-[var(--muted)]">The next NBA slate will appear here automatically once it is posted.</p>
            </motion.div>
          ) : (
            <div className="space-y-4">
              {liveGames.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-[var(--signal-red)]">
                    <span className="live-dot" />
                    <span className="font-medium uppercase tracking-wider">Live Now</span>
                  </div>
                  <div className="grid gap-3 xl:grid-cols-2">
                    {renderGameSection(liveGames, 0)}
                  </div>
                </div>
              )}

              {upcomingGames.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">Upcoming</div>
                  <div className="grid gap-3 xl:grid-cols-2">
                    {renderGameSection(upcomingGames, liveGames.length)}
                  </div>
                </div>
              )}

              {finalGames.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">Final</div>
                  <div className="grid gap-3 xl:grid-cols-2">
                    {renderGameSection(finalGames, liveGames.length + upcomingGames.length)}
                  </div>
                </div>
              )}
            </div>
          )}
        </motion.section>

        <motion.div variants={itemVariants}>
          <RestoreAccess onRestore={unlockDailyPrediction} />
        </motion.div>

        <AnimatePresence>
          {selectedGame && (
            <ChatModal
              game={selectedGame}
              onClose={handleCloseChat}
              onShareRequest={() => handleShare()}
              isShareBusy={isShareBusy}
              onMessagesChange={setChatMessages}
            />
          )}
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
