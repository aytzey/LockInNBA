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
    return { className: "border border-[color:var(--line)] bg-[color:var(--panel-soft)] text-[var(--muted)]", label: "FINAL" };
  }
  return { className: "border border-[color:var(--line)] bg-[color:var(--panel-soft)] text-[var(--muted)]", label: "UPCOMING" };
}

export default function GameCard({ game, onOpenChat }: GameCardProps) {
  const badge = statusBadge(game.status);
  const isLive = game.status === "live";
  const hasScore = game.awayScore !== null && game.homeScore !== null;
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
      className={`spotlight-card card-lift group relative w-full overflow-hidden rounded-[1.6rem] border bg-[color:var(--panel)] p-5 text-left focus:outline-none focus-ring ${
        isLive
          ? "border-[color:var(--signal-red-line)] hover:border-[color:var(--signal-red)]"
          : "border-[color:var(--line)] hover:border-[color:var(--accent-line)]"
      }`}
    >
      <div className={`absolute left-[20%] right-[20%] top-0 h-px ${
        isLive
          ? "bg-gradient-to-r from-transparent via-[color:var(--signal-red-line)] to-transparent"
          : "bg-gradient-to-r from-transparent via-[color:var(--line)] to-transparent opacity-0 transition-opacity group-hover:opacity-100"
      }`} />

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="heading text-base font-semibold text-white md:text-lg">
            <span>{game.awayTeam}</span>
            <span className="mx-2 text-[var(--muted)]/60">@</span>
            <span>{game.homeTeam}</span>
          </div>
          <p className="mt-1 text-xs text-[var(--muted)]">{game.awayRecord} at {game.homeRecord}</p>
        </div>
        <span className={`mono flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium ${badge.className}`}>
          {isLive && <span className="live-dot" style={{ width: 6, height: 6 }} />}
          {badge.label}
        </span>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-[var(--muted)]">
        <span className="flex items-center gap-1">
          <svg className="h-3 w-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {formatEstTime(game.gameTimeEST)} EST
        </span>
        <span className="chip">{game.oddsSource}</span>
        <span className="chip">{game.spread}</span>
        <span className="chip">Total {game.total}</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className={`mono flex items-center justify-between rounded-[1.1rem] border border-[color:var(--line)] bg-[color:var(--panel-soft)] px-3 py-3 text-sm transition-colors group-hover:border-[color:var(--line-strong)] ${isPositiveMoneyline(game.awayMoneyline) ? "text-[color:var(--amber)]" : "text-[color:var(--accent-strong)]"}`}>
          <span className="text-xs text-[var(--muted)]">{game.awayTeam}</span>
          <span className="number-pop font-medium">
            {game.awayMoneyline === 0 ? "OFF" : visible ? (
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
        <div className={`mono flex items-center justify-between rounded-[1.1rem] border border-[color:var(--line)] bg-[color:var(--panel-soft)] px-3 py-3 text-sm transition-colors group-hover:border-[color:var(--line-strong)] ${isPositiveMoneyline(game.homeMoneyline) ? "text-[color:var(--amber)]" : "text-[color:var(--accent-strong)]"}`}>
          <span className="text-xs text-[var(--muted)]">{game.homeTeam}</span>
          <span className="number-pop font-medium">
            {game.homeMoneyline === 0 ? "OFF" : visible ? (
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

      {hasScore && (
        <div className={`mt-3 rounded-[1rem] border px-3 py-3 ${isLive
          ? "border-[color:var(--signal-red-line)] bg-[color:var(--signal-red-soft)]"
          : "border-[color:var(--line)] bg-white/[0.02]"
        }`}>
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className={`mono font-medium ${isLive ? "text-[color:var(--signal-red)]" : "text-[var(--muted)]"}`}>
              {isLive ? game.statusDetail : "Final score"}
            </span>
            {isLive && <span className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--signal-red)]">Live board</span>}
          </div>
          <div className="mt-2 grid grid-cols-[1fr_auto] gap-2 text-sm text-white">
            <span className="mono text-[var(--muted)]">{game.awayTeam}</span>
            <span className="mono text-right text-lg font-semibold">
              {isLive ? game.awayScore : visible ? <CountUp end={game.awayScore!} duration={1.2} useEasing /> : game.awayScore}
            </span>
            <span className="mono text-[var(--muted)]">{game.homeTeam}</span>
            <span className="mono text-right text-lg font-semibold">
              {isLive ? game.homeScore : visible ? <CountUp end={game.homeScore!} duration={1.2} useEasing /> : game.homeScore}
            </span>
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-3 border-t border-[color:var(--line)] pt-4 md:grid-cols-[1fr_auto] md:items-end">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Match pulse</p>
          <p className="text-sm leading-6 text-[color:var(--text-soft)]">
            {game.awayTeam}: {game.awayLeader}. {game.homeTeam}: {game.homeLeader}.
          </p>
          <p className="text-xs text-[var(--muted)]">{game.broadcast} · {game.venue}</p>
        </div>

        <div className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--accent-line)] bg-[color:var(--accent-soft)] px-3 py-2 text-xs font-semibold text-[color:var(--accent-strong)] transition-all duration-200 group-hover:translate-x-1">
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          Open matchup chat
        </div>
      </div>
    </button>
  );
}
