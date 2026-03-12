"use client";

import { useRef, useState } from "react";
import CountUp from "react-countup";
import type { Game } from "./types";
import { formatEstTime, moneyline, isPositiveMoneyline } from "./utils";

interface GameCardProps {
  game: Game;
  onOpenChat: (game: Game) => void;
}

function statusBadge(status: Game["status"]): { className: string; label: string } {
  if (status === "live") {
    return { className: "badge-live text-white", label: "LIVE" };
  }
  if (status === "final") {
    return { className: "bg-[#2a3142] text-[#8b92a5]", label: "FINAL" };
  }
  return { className: "bg-[#1c2233] text-[#8b92a5]", label: "UPCOMING" };
}

export default function GameCard({ game, onOpenChat }: GameCardProps) {
  const badge = statusBadge(game.status);
  const isLive = game.status === "live";
  const cardRef = useRef<HTMLButtonElement>(null);
  const [visible, setVisible] = useState(false);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const setCardRef = (el: HTMLButtonElement | null) => {
    (cardRef as React.MutableRefObject<HTMLButtonElement | null>).current = el;
    if (!el) return;
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observerRef.current?.disconnect(); } },
      { threshold: 0.3 }
    );
    observerRef.current.observe(el);
  };

  function handleMouseMove(e: React.MouseEvent) {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
    el.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
  }

  return (
    <button
      ref={setCardRef}
      type="button"
      onClick={() => onOpenChat(game)}
      onMouseMove={handleMouseMove}
      className={`spotlight-card card-lift group relative w-full overflow-hidden rounded-xl border bg-gradient-to-br from-[#111d30] to-[#0d1422] p-4 text-left focus:outline-none focus-ring ${
        isLive
          ? "border-[#ff3b3b]/30 hover:border-[#ff3b3b]/50"
          : "border-[#2a3852]/60 hover:border-[#00c853]/40"
      }`}
    >
      {/* Top glow line */}
      <div className={`absolute left-[20%] right-[20%] top-0 h-px ${
        isLive
          ? "bg-gradient-to-r from-transparent via-[#ff3b3b]/40 to-transparent"
          : "bg-gradient-to-r from-transparent via-[#2a3852] to-transparent opacity-0 transition-opacity group-hover:opacity-100"
      }`} />

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="heading text-base font-semibold text-white md:text-lg">
          <span>{game.awayTeam}</span>
          <span className="mx-2 text-[#8b92a5]/60">vs</span>
          <span>{game.homeTeam}</span>
        </div>
        <span className={`mono flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium ${badge.className}`}>
          {isLive && <span className="live-dot" style={{ width: 6, height: 6 }} />}
          {badge.label}
        </span>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-[#8b92a5]">
        <span className="flex items-center gap-1">
          <svg className="h-3 w-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {formatEstTime(game.gameTimeEST)} EST
        </span>
        <span className="rounded bg-white/[0.04] px-1.5 py-0.5 text-[10px]">{game.oddsSource}</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className={`mono flex items-center justify-between rounded-lg border border-white/[0.04] bg-black/20 px-3 py-2.5 text-sm transition-colors group-hover:border-white/[0.08] ${isPositiveMoneyline(game.awayMoneyline) ? "text-[#ff6b35]" : "text-[#00c853]"}`}>
          <span className="text-xs text-[#8b92a5]">{game.awayTeam}</span>
          <span className="number-pop font-medium">
            {visible ? (
              <CountUp
                start={0}
                end={Math.abs(game.awayMoneyline)}
                duration={1.2}
                prefix={game.awayMoneyline >= 0 ? "+" : "-"}
                useEasing
              />
            ) : moneyline(game.awayMoneyline)}
          </span>
        </div>
        <div className={`mono flex items-center justify-between rounded-lg border border-white/[0.04] bg-black/20 px-3 py-2.5 text-sm transition-colors group-hover:border-white/[0.08] ${isPositiveMoneyline(game.homeMoneyline) ? "text-[#ff6b35]" : "text-[#00c853]"}`}>
          <span className="text-xs text-[#8b92a5]">{game.homeTeam}</span>
          <span className="number-pop font-medium">
            {visible ? (
              <CountUp
                start={0}
                end={Math.abs(game.homeMoneyline)}
                duration={1.2}
                prefix={game.homeMoneyline >= 0 ? "+" : "-"}
                useEasing
              />
            ) : moneyline(game.homeMoneyline)}
          </span>
        </div>
      </div>

      {game.status === "final" && game.awayScore !== null && game.homeScore !== null && (
        <div className="mt-3 flex items-center justify-center gap-4 rounded-lg bg-white/[0.02] py-2 text-xs">
          <span className="mono font-medium text-white">
            {game.awayTeam}{" "}
            {visible ? <CountUp end={game.awayScore!} duration={1.5} useEasing /> : game.awayScore}
          </span>
          <span className="text-[#8b92a5]">-</span>
          <span className="mono font-medium text-white">
            {game.homeTeam}{" "}
            {visible ? <CountUp end={game.homeScore!} duration={1.5} useEasing /> : game.homeScore}
          </span>
        </div>
      )}

      <div className="neon-green mt-3 flex items-center justify-center gap-1.5 text-xs text-[#00c853] opacity-0 transition-all duration-200 group-hover:opacity-100">
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        Discuss with AI
      </div>
    </button>
  );
}
