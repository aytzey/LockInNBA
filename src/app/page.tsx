"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

function splitTeaser(text: string): { headline: string; body: string } {
  const lines = text.split("\n").filter((line) => line.trim().length > 0);
  const headline = lines.slice(0, 2).join(" ") || "Tonight's top edge is being evaluated...";
  const body = lines.slice(2).join("\n") || "Full analysis loading...";
  return { headline, body };
}

export default function HomePage() {
  const shareCardRef = useRef<HTMLDivElement>(null);
  const gameSectionRef = useRef<HTMLDivElement>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [todayPrediction, setTodayPrediction] = useState<TodayPrediction | null>(null);
  const [socialProof, setSocialProof] = useState("");
  const [games, setGames] = useState<Game[]>([]);

  const [dailyMarkdown, setDailyMarkdown] = useState("");
  const [dailyUnlocked, setDailyUnlocked] = useState(false);

  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  const [isShareBusy, setIsShareBusy] = useState(false);
  const [shareMode, setShareMode] = useState<"daily" | "chat">("daily");

  const preview = splitTeaser(todayPrediction?.teaserText || "");

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
        const [pRes, gRes, bRes] = await Promise.all([
          fetch("/api/predictions/today"),
          fetch("/api/games/today"),
          fetch("/api/social-proof"),
        ]);
        const [pBody, gBody, bBody] = await Promise.all([
          pRes.ok ? pRes.json() : Promise.resolve(null),
          gRes.ok ? gRes.json() : Promise.resolve(null),
          bRes.ok ? bRes.json() : Promise.resolve(null),
        ]);
        if (pBody) setTodayPrediction(pBody);
        if (gBody?.games) setGames(gBody.games);
        setSocialProof(bBody?.text || "");

        const savedToken = window.localStorage.getItem(DAILY_TOKEN_KEY);
        if (savedToken) {
          await unlockDailyPrediction(savedToken);
        }
      } finally {
        setIsLoading(false);
      }
    }

    init().catch(() => setIsLoading(false));
  }, [unlockDailyPrediction]);

  function handleOpenChat(game: Game) {
    setSelectedGame(game);
    setShareMode("chat");
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

  return (
    <main className="min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-5 px-4 py-6 pb-16 text-sm md:px-8">
        <Header />

        <SocialProofBanner text={socialProof} />

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

        <section ref={gameSectionRef} className="space-y-4">
          <div>
            <h2 className="heading text-xl text-white">Tonight&apos;s Matchups</h2>
            <p className="mt-1 text-xs text-[#8b92a5]">
              Moneyline only &middot; American odds &middot; Click any game for AI analysis
            </p>
          </div>

          {isLoading ? (
            <GameListSkeleton />
          ) : games.length === 0 ? (
            <div className="rounded-lg border border-[#2a3852] bg-[#101a2c] p-8 text-center">
              <div className="mb-2 text-3xl">🏀</div>
              <p className="text-sm text-[#8b92a5]">No games scheduled for today.</p>
              <p className="mt-1 text-xs text-[#8b92a5]">Check back tomorrow for the next slate.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {liveGames.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-[#ff3b3b]">
                    <span className="live-dot" />
                    <span className="font-medium uppercase">Live Now</span>
                  </div>
                  <div className="space-y-3">
                    {liveGames.map((game) => (
                      <GameCard key={game.id} game={game} onOpenChat={handleOpenChat} />
                    ))}
                  </div>
                </div>
              )}

              {upcomingGames.length > 0 && (
                <div className="space-y-2">
                  {liveGames.length > 0 && (
                    <div className="text-xs font-medium uppercase text-[#8b92a5]">Upcoming</div>
                  )}
                  <div className="space-y-3">
                    {upcomingGames.map((game) => (
                      <GameCard key={game.id} game={game} onOpenChat={handleOpenChat} />
                    ))}
                  </div>
                </div>
              )}

              {finalGames.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-medium uppercase text-[#8b92a5]">Final</div>
                  <div className="space-y-3">
                    {finalGames.map((game) => (
                      <GameCard key={game.id} game={game} onOpenChat={handleOpenChat} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        <RestoreAccess onRestore={unlockDailyPrediction} />

        {selectedGame && (
          <ChatModal
            game={selectedGame}
            onClose={handleCloseChat}
            onShareRequest={() => handleShare()}
            isShareBusy={isShareBusy}
          />
        )}

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
