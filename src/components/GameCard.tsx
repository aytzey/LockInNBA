"use client";
/* eslint-disable @next/next/no-img-element */

import type { Game } from "./types";
import { formatEstTime, moneyline } from "./utils";

interface GameCardProps {
  game: Game;
  onOpenChat: (game: Game) => void;
  promoActive?: boolean;
}

function statusBadge(game: Game): { label: string; className: string } {
  if (game.status === "live") {
    return { label: "LIVE", className: "game-card__badge game-card__badge--live" };
  }

  if (game.status === "final") {
    return {
      label:
        game.awayScore !== null && game.homeScore !== null
          ? `FINAL ${game.awayScore}-${game.homeScore}`
          : "FINAL",
      className: "game-card__badge game-card__badge--final",
    };
  }

  return { label: "UPCOMING", className: "game-card__badge game-card__badge--upcoming" };
}

export default function GameCard({ game, onOpenChat, promoActive = false }: GameCardProps) {
  const badge = statusBadge(game);
  const showScore = game.status !== "upcoming" && game.awayScore !== null && game.homeScore !== null;

  return (
    <button
      type="button"
      onClick={() => onOpenChat(game)}
      className="game-card focus-ring"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <div className="game-card__logos">
              <img src={game.awayLogo} alt="" className="game-card__logo" loading="lazy" />
              <img src={game.homeLogo} alt="" className="game-card__logo" loading="lazy" />
            </div>
            <div>
              <div className="heading text-[1.15rem] text-[color:var(--pure-white)] md:text-[1.3rem]">
                {game.awayTeam} <span className="text-[color:var(--silver-gray)]">@</span> {game.homeTeam}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-[color:var(--silver-gray)]">
                <span>{formatEstTime(game.gameTimeEST)}</span>
                <span className="text-[color:var(--line-strong)]">•</span>
                <span>via {game.oddsSource}</span>
              </div>
            </div>
          </div>
        </div>

        <span className={badge.className}>
          {game.status === "live" ? <span className="live-dot" /> : null}
          {badge.label}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="game-card__moneyline">
          <span className="game-card__team-label">{game.awayTeam}</span>
          <span className="game-card__moneyline-value">{moneyline(game.awayMoneyline)}</span>
        </div>
        <div className="game-card__moneyline">
          <span className="game-card__team-label">{game.homeTeam}</span>
          <span className="game-card__moneyline-value">{moneyline(game.homeMoneyline)}</span>
        </div>
      </div>

      {showScore ? (
        <div className="mt-4 grid gap-2 rounded-[1rem] border border-[color:var(--line)] bg-[color:var(--panel-soft)] px-4 py-3">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-[color:var(--silver-gray)]">
            <span>{game.status === "live" ? game.statusDetail : "Final score"}</span>
            <span>{game.status === "live" ? "Live" : "Final"}</span>
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-2 text-sm text-[color:var(--pure-white)]">
            <span className="mono text-[color:var(--silver-gray)]">{game.awayTeam}</span>
            <span className="mono text-right text-base">{game.awayScore}</span>
            <span className="mono text-[color:var(--silver-gray)]">{game.homeTeam}</span>
            <span className="mono text-right text-base">{game.homeScore}</span>
          </div>
        </div>
      ) : null}

      <div className="mt-5 flex items-center justify-end border-t border-[color:var(--line)] pt-4">
        <span className="game-card__cta">{promoActive ? "Ask AI Free" : "Ask AI"}</span>
      </div>
    </button>
  );
}
